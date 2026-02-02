/**
 * Prompt Similarity Analysis
 *
 * Calculates semantic similarity between prompts using vector embeddings.
 * Uses cosine similarity to compare the target prompt against other prompts
 * from the same user in the same project.
 *
 * GET /api/analysis/prompt-similarity?projectId={id}&recordId={id}
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { cosineSimilarity } from '@/lib/ai';

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

    // 1. Get the target prompt
    let targetPrompt;
    try {
        targetPrompt = await prisma.dataRecord.findUnique({
            where: { id: recordId },
            select: { id: true, embedding: true, createdById: true }
        });
    } catch (dbError: any) {
        console.error('Similarity API Error: Failed to fetch target prompt', {
            recordId,
            projectId,
            error: dbError.message
        });
        return NextResponse.json({
            error: 'Database error while fetching target prompt. Please try again.'
        }, { status: 500 });
    }

    if (!targetPrompt) {
        return NextResponse.json({ error: 'Target prompt not found' }, { status: 404 });
    }

    if (!targetPrompt.embedding || targetPrompt.embedding.length === 0) {
        console.error('Similarity API Error: Target prompt missing embedding', {
            recordId,
            projectId,
            hasPrompt: !!targetPrompt,
            hasEmbedding: !!targetPrompt?.embedding,
            embeddingLength: targetPrompt?.embedding?.length
        });
        return NextResponse.json({
            error: 'Target prompt does not have an embedding yet. Please wait for vectorization to complete or trigger it manually.'
        }, { status: 404 });
    }

    // 2. Get all other prompts FROM THE SAME USER in the same project
    // Note: We limit to same-user prompts to provide personalized similarity insights
    // and avoid privacy concerns from cross-user content comparison
    let otherPrompts;
    try {
        otherPrompts = await prisma.dataRecord.findMany({
            where: {
                projectId,
                type: 'TASK',
                createdById: targetPrompt.createdById,
                id: { not: recordId },
                embedding: { isEmpty: false }
            },
            select: {
                id: true,
                content: true,
                category: true,
                embedding: true,
                createdAt: true
            }
        });
    } catch (dbError: any) {
        console.error('Similarity API Error: Failed to fetch other prompts', {
            recordId,
            projectId,
            createdById: targetPrompt.createdById,
            error: dbError.message
        });
        return NextResponse.json({
            error: 'Database error while fetching prompts for comparison. Please try again.'
        }, { status: 500 });
    }

    // 3. Calculate similarities
    try {
        const similarPrompts = otherPrompts
            .map(p => ({
                id: p.id,
                content: p.content,
                category: p.category,
                createdAt: p.createdAt.toISOString(),
                similarity: Math.round(cosineSimilarity(targetPrompt.embedding, p.embedding) * 100)
            }))
            .sort((a, b) => b.similarity - a.similarity);

        console.log('Similarity API: Calculated prompt similarities', {
            recordId,
            projectId,
            userId: user.id,
            comparedCount: otherPrompts.length,
            topSimilarity: similarPrompts[0]?.similarity || 0
        });

        return NextResponse.json({ similarPrompts });
    } catch (calcError: any) {
        console.error('Similarity API Error: Failed to calculate similarities', {
            recordId,
            projectId,
            error: calcError.message,
            stack: calcError.stack
        });
        return NextResponse.json({
            error: 'Error calculating similarities. Please try again or contact support.'
        }, { status: 500 });
    }
}
