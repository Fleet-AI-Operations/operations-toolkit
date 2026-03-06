import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/task-search/user-similarity
 * Body: { recordId: string }
 *
 * Finds other tasks submitted by the same user (matched by createdByEmail or
 * createdById) within the same environment, ranked by vector similarity.
 *
 * Prefers version 1 tasks. Falls back to all versions if the user has no v1 tasks.
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
        console.error('[UserSimilarity] Auth check failed', { message: authError.message });
    }
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let profile;
    try {
        profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true },
        });
    } catch (profileErr) {
        console.error('[UserSimilarity] Failed to fetch profile for user', user.id, profileErr);
        return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
    }

    if (!profile || !['CORE', 'FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let recordId: string;
    let latestOnly = false;
    try {
        ({ recordId, latestOnly = false } = await request.json());
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!recordId) {
        return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
    }

    // Fetch the source record to get user identity and confirm it has an embedding
    let sourceRows: Array<{
        id: string;
        createdByEmail: string | null;
        createdById: string | null;
        environment: string;
        has_embedding: boolean;
    }>;
    try {
        sourceRows = await prisma.$queryRaw`
            SELECT id, "createdByEmail", "createdById", environment, embedding IS NOT NULL AS has_embedding
            FROM public.data_records
            WHERE id = ${recordId}
        `;
    } catch (dbErr) {
        console.error('[UserSimilarity] Failed to fetch source record', { recordId, userId: user.id }, dbErr);
        return NextResponse.json({ error: 'Failed to look up source record. Please try again.' }, { status: 500 });
    }
    const [source] = sourceRows;

    if (!source) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    if (!source.environment || source.environment.trim() === '') {
        return NextResponse.json({
            error: 'Source record has no environment value — cannot scope similarity search.'
        }, { status: 422 });
    }

    if (!source.has_embedding) {
        return NextResponse.json({
            error: 'This record has no embedding yet. Run vectorization before checking similarity.'
        }, { status: 422 });
    }

    if (!source.createdByEmail && !source.createdById) {
        return NextResponse.json({
            error: 'No user identity on this record — cannot scope to a single user.'
        }, { status: 422 });
    }

    type SimilarityRow = {
        id: string;
        content: string;
        environment: string;
        createdByName: string | null;
        createdByEmail: string | null;
        createdAt: Date;
        taskKey: string | null;
        taskVersion: string | null;
        similarity: number;
    };

    const userFilter = source.createdByEmail
        ? Prisma.sql`("createdByEmail" = ${source.createdByEmail} OR metadata->>'author_email' = ${source.createdByEmail})`
        : Prisma.sql`"createdById" = ${source.createdById}`;

    let matches: SimilarityRow[];
    let versionFiltered = false;

    try {
    if (latestOnly) {
        // DISTINCT ON: keep only the highest version per task_key for this user.
        matches = await prisma.$queryRaw`
            SELECT
                id, content, environment, "createdByName", "createdByEmail", "createdAt",
                metadata->>'task_key' AS "taskKey",
                metadata->>'task_version' AS "taskVersion",
                ROUND((1 - (embedding <=> (
                    SELECT embedding FROM public.data_records WHERE id = ${recordId}
                ))) * 100) AS similarity
            FROM (
                SELECT DISTINCT ON (COALESCE(metadata->>'task_key', id))
                    id, content, environment, "createdByName", "createdByEmail", "createdAt", metadata, embedding
                FROM public.data_records
                WHERE type = 'TASK'
                AND id != ${recordId}
                AND embedding IS NOT NULL
                AND TRIM(content) != (SELECT TRIM(content) FROM public.data_records WHERE id = ${recordId})
                AND ${userFilter}
                AND environment = ${source.environment}
                ORDER BY COALESCE(metadata->>'task_key', id),
                         CAST(COALESCE(NULLIF(metadata->>'task_version', ''), NULLIF(metadata->>'version_no', ''), '0') AS INTEGER) DESC,
                         "createdAt" DESC
            ) latest
            ORDER BY embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${recordId})
            LIMIT 20
        `;
        versionFiltered = true;
    } else {
        // Check if this user has any version 1 tasks — if not, fall back to all versions.
        const [{ v1_count }] = await prisma.$queryRaw<[{ v1_count: bigint }]>`
            SELECT COUNT(*) AS v1_count FROM public.data_records
            WHERE type = 'TASK' AND id != ${recordId}
            AND ${userFilter}
            AND metadata->>'task_version' = '1'
            AND environment = ${source.environment}
        `;

        const hasV1 = Number(v1_count) > 0;
        versionFiltered = hasV1;

        matches = await prisma.$queryRaw`
            SELECT
                id, content, environment, "createdByName", "createdByEmail", "createdAt",
                metadata->>'task_key' AS "taskKey",
                metadata->>'task_version' AS "taskVersion",
                ROUND((1 - (embedding <=> (
                    SELECT embedding FROM public.data_records WHERE id = ${recordId}
                ))) * 100) AS similarity
            FROM public.data_records
            WHERE type = 'TASK'
            AND id != ${recordId}
            AND embedding IS NOT NULL
            AND TRIM(content) != (SELECT TRIM(content) FROM public.data_records WHERE id = ${recordId})
            AND ${userFilter}
            ${hasV1 ? Prisma.sql`AND metadata->>'task_version' = '1'` : Prisma.sql``}
            AND environment = ${source.environment}
            ORDER BY embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${recordId})
            LIMIT 20
        `;
    }

    } catch (dbErr) {
        console.error('[UserSimilarity] Similarity query failed', { recordId, userId: user.id }, dbErr);
        return NextResponse.json({ error: 'Failed to calculate similarity. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({
        matches: matches.map(m => ({
            ...m,
            similarity: Number(m.similarity),
            createdAt: new Date(m.createdAt).toISOString(),
        })),
        versionFiltered,
    });
}
