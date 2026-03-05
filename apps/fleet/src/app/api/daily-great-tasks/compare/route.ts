import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { cosineSimilarity } from '@repo/core/ai';

export const dynamic = 'force-dynamic';

async function requireFleetAuth(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('[DailyGreatCompare] Failed to fetch profile for user', user.id, profileError);
        return { error: NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 }) };
    }

    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { user, profile };
}

function parseVector(embedding: any): number[] | null {
    if (!embedding) return null;

    if (Array.isArray(embedding)) return embedding;

    if (typeof embedding === 'string') {
        try {
            const cleaned = embedding.replace(/[\[\]]/g, '');
            const values = cleaned.split(',').map((v: string) => parseFloat(v.trim()));
            if (values.some((v: number) => isNaN(v))) return null;
            return values;
        } catch (err) {
            console.error('[DailyGreatCompare] parseVector unexpected error:', err, 'Input:', String(embedding).slice(0, 100));
            return null;
        }
    }

    return null;
}

/**
 * POST /api/daily-great-tasks/compare
 * Body: { environment, threshold? }  (threshold 0–100, default 80)
 * Returns inline comparison results (no persistence).
 * Auth: FLEET+
 */
export async function POST(request: NextRequest) {
    const authResult = await requireFleetAuth(request);
    if (authResult.error) return authResult.error;

    let body: { environment?: unknown; threshold?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }

    try {
        const { environment, threshold } = body;

        if (!environment) {
            return NextResponse.json({ error: 'environment is required' }, { status: 400 });
        }

        const similarityThreshold = typeof threshold === 'number' && threshold >= 0 && threshold <= 100
            ? threshold
            : 80;

        // Fetch daily great records with embeddings
        const dailyGreats = await prisma.$queryRaw<Array<{
            id: string;
            content: string;
            embedding: string;
            task_key: string | null;
        }>>`
            SELECT id, content, embedding::text, metadata->>'task_key' AS task_key
            FROM public.data_records
            WHERE is_daily_great = true
            AND type = 'TASK'
            AND embedding IS NOT NULL
        `;

        if (dailyGreats.length === 0) {
            return NextResponse.json({
                error: 'No daily great task records with embeddings found. Flag some records first.',
            }, { status: 400 });
        }

        // Fetch real task records in the environment (limit 2000)
        const tasks = await prisma.$queryRaw<Array<{
            id: string;
            content: string;
            embedding: string;
            createdByName: string | null;
            createdByEmail: string | null;
        }>>`
            SELECT id, content, embedding::text, "createdByName", "createdByEmail"
            FROM public.data_records
            WHERE LOWER(environment) = LOWER(${environment})
            AND type = 'TASK'
            AND is_daily_great = false
            AND embedding IS NOT NULL
            LIMIT 2000
        `;

        if (tasks.length === 0) {
            return NextResponse.json({
                error: `No task records with embeddings found in environment "${environment}". Check that the environment name is correct and that records have been vectorized.`,
            }, { status: 400 });
        }

        const totalTasks = tasks.length;
        const totalDailyGreat = dailyGreats.length;

        // Parse daily great embeddings
        const parsedGreats = dailyGreats.map(g => ({
            ...g,
            vector: parseVector(g.embedding),
        })).filter(g => g.vector !== null);

        const missingEmbeddings = dailyGreats.length - parsedGreats.length;

        const matches: Array<{
            taskId: string;
            taskContent: string;
            taskAuthor: string | null;
            taskEmail: string | null;
            exemplarId: string;
            exemplarContent: string;
            exemplarTaskKey: string | null;
            similarity: number;
        }> = [];

        let tasksSkippedNoParse = 0;

        for (const task of tasks) {
            const taskVector = parseVector(task.embedding);
            if (!taskVector) {
                tasksSkippedNoParse++;
                continue;
            }

            let bestSimilarity = -1;
            let bestGreat: typeof parsedGreats[0] | null = null;

            for (const great of parsedGreats) {
                // Skip identical content
                if (task.content.trim() === great.content.trim()) continue;

                const similarity = cosineSimilarity(taskVector, great.vector!);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestGreat = great;
                }
            }

            if (bestGreat === null) continue;

            const similarityPercent = bestSimilarity * 100;
            if (isNaN(similarityPercent) || !isFinite(similarityPercent)) continue;

            if (similarityPercent >= similarityThreshold) {
                matches.push({
                    taskId: task.id,
                    taskContent: task.content,
                    taskAuthor: task.createdByName ?? null,
                    taskEmail: task.createdByEmail ?? null,
                    exemplarId: bestGreat.id,
                    exemplarContent: bestGreat.content,
                    exemplarTaskKey: bestGreat.task_key ?? null,
                    similarity: similarityPercent,
                });
            }
        }

        matches.sort((a, b) => b.similarity - a.similarity);

        return NextResponse.json({
            matches,
            totalTasks,
            totalDailyGreat,
            missingEmbeddings,
            tasksSkippedNoParse,
        });
    } catch (err) {
        console.error('[DailyGreatCompare] Error running comparison:', err);
        return NextResponse.json({ error: 'Failed to run comparison' }, { status: 500 });
    }
}
