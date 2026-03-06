/**
 * Red Zone Prompts
 *
 * Finds all pairs of tasks with cosine similarity >= threshold using a pgvector self-join.
 * Scans the most recent 500 tasks (with embeddings) to keep query time reasonable.
 *
 * GET /api/analytics/red-zone?threshold={number}&environment={string}
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

const MAX_TASKS = 500;

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const threshold = Math.min(
        100,
        Math.max(0, Number(req.nextUrl.searchParams.get('threshold') ?? '70'))
    );
    const environment = req.nextUrl.searchParams.get('environment') || null;

    try {
        // Count tasks with embeddings (for the stats bar)
        const countResult: { count: bigint }[] = environment
            ? await prisma.$queryRaw`
                SELECT COUNT(*) as count
                FROM public.data_records
                WHERE type = 'TASK'
                AND embedding IS NOT NULL
                AND "environment" = ${environment}
            `
            : await prisma.$queryRaw`
                SELECT COUNT(*) as count
                FROM public.data_records
                WHERE type = 'TASK'
                AND embedding IS NOT NULL
            `;

        const totalTasksWithEmbeddings = Number(countResult[0]?.count ?? 0);

        // Self-join on the most recent MAX_TASKS records to find high-similarity pairs.
        // a.id < b.id avoids returning both (a,b) and (b,a).
        // Identical content is excluded (handles duplicate records).
        interface PairRow {
            id1: string;
            content1: string;
            name1: string | null;
            email1: string | null;
            at1: Date;
            id2: string;
            content2: string;
            name2: string | null;
            email2: string | null;
            at2: Date;
            similarity: number;
        }

        const pairs: PairRow[] = environment
            ? await prisma.$queryRaw`
                SELECT
                    a.id          AS id1,
                    a.content     AS content1,
                    a."createdByName"  AS name1,
                    a."createdByEmail" AS email1,
                    a."createdAt" AS at1,
                    b.id          AS id2,
                    b.content     AS content2,
                    b."createdByName"  AS name2,
                    b."createdByEmail" AS email2,
                    b."createdAt" AS at2,
                    ROUND((1 - (a.embedding <=> b.embedding)) * 100) AS similarity
                FROM (
                    SELECT id, content, "createdByName", "createdByEmail", "createdAt", embedding
                    FROM public.data_records
                    WHERE type = 'TASK'
                    AND embedding IS NOT NULL
                    AND "environment" = ${environment}
                    ORDER BY "createdAt" DESC
                    LIMIT ${MAX_TASKS}
                ) a
                JOIN (
                    SELECT id, content, "createdByName", "createdByEmail", "createdAt", embedding
                    FROM public.data_records
                    WHERE type = 'TASK'
                    AND embedding IS NOT NULL
                    AND "environment" = ${environment}
                    ORDER BY "createdAt" DESC
                    LIMIT ${MAX_TASKS}
                ) b ON a.id < b.id
                WHERE TRIM(a.content) != TRIM(b.content)
                AND (1 - (a.embedding <=> b.embedding)) * 100 >= ${threshold}
                ORDER BY similarity DESC
                LIMIT 200
            `
            : await prisma.$queryRaw`
                SELECT
                    a.id          AS id1,
                    a.content     AS content1,
                    a."createdByName"  AS name1,
                    a."createdByEmail" AS email1,
                    a."createdAt" AS at1,
                    b.id          AS id2,
                    b.content     AS content2,
                    b."createdByName"  AS name2,
                    b."createdByEmail" AS email2,
                    b."createdAt" AS at2,
                    ROUND((1 - (a.embedding <=> b.embedding)) * 100) AS similarity
                FROM (
                    SELECT id, content, "createdByName", "createdByEmail", "createdAt", embedding
                    FROM public.data_records
                    WHERE type = 'TASK'
                    AND embedding IS NOT NULL
                    ORDER BY "createdAt" DESC
                    LIMIT ${MAX_TASKS}
                ) a
                JOIN (
                    SELECT id, content, "createdByName", "createdByEmail", "createdAt", embedding
                    FROM public.data_records
                    WHERE type = 'TASK'
                    AND embedding IS NOT NULL
                    ORDER BY "createdAt" DESC
                    LIMIT ${MAX_TASKS}
                ) b ON a.id < b.id
                WHERE TRIM(a.content) != TRIM(b.content)
                AND (1 - (a.embedding <=> b.embedding)) * 100 >= ${threshold}
                ORDER BY similarity DESC
                LIMIT 200
            `;

        return NextResponse.json({
            totalPrompts: Math.min(totalTasksWithEmbeddings, MAX_TASKS),
            totalTasksWithEmbeddings,
            pairs: pairs.map(p => ({
                prompt1: {
                    id: p.id1,
                    content: p.content1,
                    createdByName: p.name1,
                    createdByEmail: p.email1,
                    createdAt: p.at1.toISOString(),
                },
                prompt2: {
                    id: p.id2,
                    content: p.content2,
                    createdByName: p.name2,
                    createdByEmail: p.email2,
                    createdAt: p.at2.toISOString(),
                },
                similarity: Number(p.similarity),
            })),
        });
    } catch (error: unknown) {
        console.error('Red Zone API Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Failed to compute red zone pairs', details: message }, { status: 500 });
    }
}
