/**
 * Prompt Similarity Analysis
 *
 * Calculates semantic similarity between prompts using vector embeddings.
 * Uses pgvector's cosine distance operator for efficient similarity search.
 *
 * GET /api/analysis/prompt-similarity?environment={id}&recordId={id}
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { Prisma } from '@prisma/client';
import { createClient } from '@repo/auth/server';

interface SimilarPrompt {
    id: string;
    content: string;
    category: string | null;
    metadata: any;
    createdAt: Date;
    similarity: number;
}

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
        console.error('[PromptSimilarity] Auth check failed', { message: authError.message });
    }
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { role: true },
    });
    if (!profile || !['QA', 'CORE', 'FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const environment = req.nextUrl.searchParams.get('environment');
    const recordId = req.nextUrl.searchParams.get('recordId');

    if (!recordId) {
        return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    try {
        // 1. Check if target prompt exists and has embedding using raw SQL
        const targetCheck: { id: string; createdById: string | null; createdByName: string | null; createdByEmail: string | null; has_embedding: boolean }[] = await prisma.$queryRaw`
            SELECT id, "createdById", "createdByName", "createdByEmail", embedding IS NOT NULL as has_embedding
            FROM public.data_records
            WHERE id = ${recordId}
        `;

        if (targetCheck.length === 0) {
            return NextResponse.json({ error: 'Target prompt not found' }, { status: 404 });
        }

        const targetPrompt = targetCheck[0];

        if (!targetPrompt.has_embedding) {
            console.warn('[PromptSimilarity] Target prompt missing embedding', {
                recordId,
                environment
            });
            return NextResponse.json({
                error: 'Target prompt does not have an embedding yet. Please wait for vectorization to complete or trigger it manually.'
            }, { status: 404 });
        }

        // 2. Get similar prompts from the same user using pgvector's cosine distance
        // Also exclude prompts with identical content (handles duplicate records)
        // Filter by environment if provided
        //
        // createdById may be null for CSV-ingested records. SQL `column = NULL` is always false,
        // so we fall back to matching by createdByName / createdByEmail when createdById is null.
        if (targetPrompt.createdById === null && targetPrompt.createdByName === null && targetPrompt.createdByEmail === null) {
            return NextResponse.json({
                error: 'No user identity on this record — cannot scope similarity to a single user.'
            }, { status: 422 });
        }

        const userFilter = targetPrompt.createdById !== null
            ? Prisma.sql`"createdById" = ${targetPrompt.createdById}`
            : targetPrompt.createdByName !== null
                ? Prisma.sql`"createdById" IS NULL AND "createdByName" = ${targetPrompt.createdByName}`
                : Prisma.sql`"createdById" IS NULL AND "createdByEmail" = ${targetPrompt.createdByEmail}`;

        const similarPrompts: SimilarPrompt[] = environment
            ? await prisma.$queryRaw`
                SELECT
                    id,
                    content,
                    category,
                    metadata,
                    "createdAt",
                    ROUND((1 - (embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${recordId}))) * 100) as similarity
                FROM public.data_records
                WHERE "environment" = ${environment}
                AND type = 'TASK'
                AND ${userFilter}
                AND id != ${recordId}
                AND embedding IS NOT NULL
                AND TRIM(content) != (SELECT TRIM(content) FROM public.data_records WHERE id = ${recordId})
                ORDER BY embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${recordId})
                LIMIT 50
            `
            : await prisma.$queryRaw`
                SELECT
                    id,
                    content,
                    category,
                    metadata,
                    "createdAt",
                    ROUND((1 - (embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${recordId}))) * 100) as similarity
                FROM public.data_records
                WHERE type = 'TASK'
                AND ${userFilter}
                AND id != ${recordId}
                AND embedding IS NOT NULL
                AND TRIM(content) != (SELECT TRIM(content) FROM public.data_records WHERE id = ${recordId})
                ORDER BY embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${recordId})
                LIMIT 50
            `;

        console.log('Similarity API: Calculated prompt similarities', {
            recordId,
            environment,
            userId: user.id,
            comparedCount: similarPrompts.length,
            topSimilarity: similarPrompts[0]?.similarity || 0
        });

        return NextResponse.json({
            similarPrompts: similarPrompts.map(p => ({
                id: p.id,
                content: p.content,
                category: p.category,
                metadata: p.metadata,
                createdAt: p.createdAt.toISOString(),
                similarity: Number(p.similarity)
            }))
        });
    } catch (error: unknown) {
        console.error('[PromptSimilarity] Query failed', error);
        return NextResponse.json({
            error: 'Error calculating similarities. Please try again or contact support.'
        }, { status: 500 });
    }
}
