import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cosineSimilarity } from '@/lib/ai';

export const dynamic = 'force-dynamic';

interface RecordWithEmbedding {
    id: string;
    content: string;
    category: string | null;
    metadata: unknown;
    embedding: string; // pgvector returns as string
}

// Parse pgvector string format "[0.1,0.2,...]" to number[]
function parseVector(vectorStr: string): number[] {
    if (!vectorStr) return [];
    const inner = vectorStr.slice(1, -1); // Remove [ and ]
    if (!inner) return [];
    return inner.split(',').map(Number);
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const threshold = parseFloat(searchParams.get('threshold') || '0.7');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    try {
        // Fetch all Tasks and Feedback with embeddings using raw SQL
        const tasks: RecordWithEmbedding[] = await prisma.$queryRaw`
            SELECT id, content, category, metadata, embedding::text as embedding
            FROM public.data_records
            WHERE "projectId" = ${projectId}
            AND type = 'TASK'
            AND embedding IS NOT NULL
        `;

        const feedbacks: RecordWithEmbedding[] = await prisma.$queryRaw`
            SELECT id, content, category, metadata, embedding::text as embedding
            FROM public.data_records
            WHERE "projectId" = ${projectId}
            AND type = 'FEEDBACK'
            AND embedding IS NOT NULL
        `;

        // Parse embeddings
        const taskEmbeds = tasks.map(t => ({
            ...t,
            parsedEmbedding: parseVector(t.embedding)
        })).filter(t => t.parsedEmbedding.length > 0);

        const feedbackEmbeds = feedbacks.map(f => ({
            ...f,
            parsedEmbedding: parseVector(f.embedding)
        })).filter(f => f.parsedEmbedding.length > 0);

        if (taskEmbeds.length === 0 || feedbackEmbeds.length === 0) {
            return NextResponse.json({ matches: [], message: 'Insufficient data for cross-analysis' });
        }

        const matches: {
            task: { id: string; content: string; category: string | null; score: unknown };
            feedback: { id: string; content: string; category: string | null };
            similarity: number;
        }[] = [];

        // Cross-compare every task with every feedback
        for (const task of taskEmbeds) {
            for (const feedback of feedbackEmbeds) {
                const sim = cosineSimilarity(task.parsedEmbedding, feedback.parsedEmbedding);
                if (sim >= threshold) {
                    matches.push({
                        task: {
                            id: task.id,
                            content: task.content,
                            category: task.category,
                            score: (task.metadata as Record<string, unknown>)?.avg_score
                        },
                        feedback: {
                            id: feedback.id,
                            content: feedback.content,
                            category: feedback.category
                        },
                        similarity: sim
                    });
                }
            }
        }

        // Sort by highest similarity and limit
        const sortedMatches = matches
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        return NextResponse.json({ matches: sortedMatches });
    } catch (error: unknown) {
        console.error('Analytics API Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
