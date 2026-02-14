/**
 * Prompt Similarity Analysis
 *
 * Calculates semantic similarity between prompts using vector embeddings.
 * Uses pgvector's cosine distance operator for efficient similarity search.
 *
 * GET /api/analysis/prompt-similarity?projectId={id}&recordId={id}
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

interface SimilarPrompt {
    id: string;
    content: string;
    category: string | null;
    createdAt: Date;
    similarity: number;
}

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get('projectId');
    const recordId = req.nextUrl.searchParams.get('recordId');

    if (!projectId || !recordId) {
        return NextResponse.json({ error: 'Project ID and Record ID are required' }, { status: 400 });
    }

    try {
        // 1. Check if target prompt exists and has embedding using raw SQL
        const targetCheck: { id: string; createdById: string | null; has_embedding: boolean }[] = await prisma.$queryRaw`
            SELECT id, "createdById", embedding IS NOT NULL as has_embedding
            FROM public.data_records
            WHERE id = ${recordId}
        `;

        if (targetCheck.length === 0) {
            return NextResponse.json({ error: 'Target prompt not found' }, { status: 404 });
        }

        const targetPrompt = targetCheck[0];

        if (!targetPrompt.has_embedding) {
            console.error('Similarity API Error: Target prompt missing embedding', {
                recordId,
                projectId
            });
            return NextResponse.json({
                error: 'Target prompt does not have an embedding yet. Please wait for vectorization to complete or trigger it manually.'
            }, { status: 404 });
        }

        // 2. Get similar prompts from the same user using pgvector's cosine distance
        // Also exclude prompts with identical content (handles duplicate records)
        const similarPrompts: SimilarPrompt[] = await prisma.$queryRaw`
            SELECT
                id,
                content,
                category,
                "createdAt",
                ROUND((1 - (embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${recordId}))) * 100) as similarity
            FROM public.data_records
            WHERE "projectId" = ${projectId}
            AND type = 'TASK'
            AND "createdById" = ${targetPrompt.createdById}
            AND id != ${recordId}
            AND embedding IS NOT NULL
            AND TRIM(content) != (SELECT TRIM(content) FROM public.data_records WHERE id = ${recordId})
            ORDER BY embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${recordId})
            LIMIT 50
        `;

        console.log('Similarity API: Calculated prompt similarities', {
            recordId,
            projectId,
            userId: user.id,
            comparedCount: similarPrompts.length,
            topSimilarity: similarPrompts[0]?.similarity || 0
        });

        return NextResponse.json({
            similarPrompts: similarPrompts.map(p => ({
                id: p.id,
                content: p.content,
                category: p.category,
                createdAt: p.createdAt.toISOString(),
                similarity: Number(p.similarity)
            }))
        });
    } catch (error: unknown) {
        console.error('Similarity API Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: 'Error calculating similarities. Please try again or contact support.',
            details: message
        }, { status: 500 });
    }
}
