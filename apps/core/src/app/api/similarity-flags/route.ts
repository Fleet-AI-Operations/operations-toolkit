import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CORE', 'FLEET', 'MANAGER', 'ADMIN'];
const VALID_STATUSES = ['OPEN', 'CLAIMED'];
const VALID_MATCH_TYPES = ['USER_HISTORY', 'DAILY_GREAT'];

type FlagRow = {
    id: string;
    similarity_job_id: string;
    source_record_id: string;
    matched_record_id: string;
    similarity_score: number;
    user_email: string | null;
    user_name: string | null;
    environment: string;
    status: string;
    claimed_by_email: string | null;
    claimed_at: Date | null;
    notified_at: Date | null;
    match_type: string;
    created_at: Date;
};

/**
 * GET /api/similarity-flags?environment=X&status=OPEN&page=1&limit=25
 * Returns paginated similarity flags with content snippets.
 * Sorted: OPEN flags first, then by created_at DESC.
 * Auth: CORE or higher role required.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const environment = searchParams.get('environment') || null;
        const statusFilter = searchParams.get('status') || null;
        const claimedBy = searchParams.get('claimedBy') || null;
        const matchTypeFilter = searchParams.get('matchType') || null;
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
        const offset = (page - 1) * limit;

        // Whitelist status and match_type to prevent injection
        const safeStatus = statusFilter && VALID_STATUSES.includes(statusFilter) ? statusFilter : null;
        const safeMatchType = matchTypeFilter && VALID_MATCH_TYPES.includes(matchTypeFilter) ? matchTypeFilter : null;
        // claimedBy=me resolves to the authenticated user's email (only meaningful with status=CLAIMED)
        const claimedByEmail = claimedBy === 'me' && safeStatus === 'CLAIMED' ? (user.email ?? null) : null;

        let flags: FlagRow[];
        let countResult: [{ count: bigint }];

        // Build query branches covering all filter combinations (env, status, claimedBy, matchType).
        // Parameterized queries are used throughout to prevent injection.
        // match_type is included in every SELECT.
        if (environment && safeStatus && claimedByEmail && safeMatchType) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE environment = ${environment} AND status = ${safeStatus}
                  AND claimed_by_email = ${claimedByEmail} AND match_type = ${safeMatchType}
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags
                WHERE environment = ${environment} AND status = ${safeStatus}
                  AND claimed_by_email = ${claimedByEmail} AND match_type = ${safeMatchType}
            `;
        } else if (environment && safeStatus && claimedByEmail) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE environment = ${environment} AND status = ${safeStatus} AND claimed_by_email = ${claimedByEmail}
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags
                WHERE environment = ${environment} AND status = ${safeStatus} AND claimed_by_email = ${claimedByEmail}
            `;
        } else if (safeStatus && claimedByEmail && safeMatchType) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE status = ${safeStatus} AND claimed_by_email = ${claimedByEmail} AND match_type = ${safeMatchType}
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags
                WHERE status = ${safeStatus} AND claimed_by_email = ${claimedByEmail} AND match_type = ${safeMatchType}
            `;
        } else if (safeStatus && claimedByEmail) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE status = ${safeStatus} AND claimed_by_email = ${claimedByEmail}
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags
                WHERE status = ${safeStatus} AND claimed_by_email = ${claimedByEmail}
            `;
        } else if (environment && safeStatus && safeMatchType) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE environment = ${environment} AND status = ${safeStatus} AND match_type = ${safeMatchType}
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags
                WHERE environment = ${environment} AND status = ${safeStatus} AND match_type = ${safeMatchType}
            `;
        } else if (environment && safeStatus) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE environment = ${environment} AND status = ${safeStatus}
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags
                WHERE environment = ${environment} AND status = ${safeStatus}
            `;
        } else if (environment && safeMatchType) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE environment = ${environment} AND match_type = ${safeMatchType}
                ORDER BY CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END, created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags
                WHERE environment = ${environment} AND match_type = ${safeMatchType}
            `;
        } else if (environment) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE environment = ${environment}
                ORDER BY CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END, created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags WHERE environment = ${environment}
            `;
        } else if (safeStatus && safeMatchType) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE status = ${safeStatus} AND match_type = ${safeMatchType}
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags
                WHERE status = ${safeStatus} AND match_type = ${safeMatchType}
            `;
        } else if (safeStatus) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE status = ${safeStatus}
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags WHERE status = ${safeStatus}
            `;
        } else if (safeMatchType) {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                WHERE match_type = ${safeMatchType}
                ORDER BY CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END, created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags WHERE match_type = ${safeMatchType}
            `;
        } else {
            flags = await prisma.$queryRaw`
                SELECT id, similarity_job_id, source_record_id, matched_record_id,
                       similarity_score, user_email, user_name, environment,
                       status, claimed_by_email, claimed_at, notified_at, match_type, created_at
                FROM public.similarity_flags
                ORDER BY CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END, created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM public.similarity_flags
            `;
        }

        const total = Number(countResult[0].count);

        // Fetch content snippets for source and matched records
        const recordIds = [
            ...flags.map(f => f.source_record_id),
            ...flags.map(f => f.matched_record_id),
        ].filter((id, i, arr) => arr.indexOf(id) === i);

        let snippets: Array<{ id: string; content: string; task_key: string | null }> = [];
        if (recordIds.length > 0) {
            snippets = await prisma.$queryRaw`
                SELECT id, SUBSTRING(content FROM 1 FOR 150) as content, metadata->>'task_key' AS task_key
                FROM public.data_records
                WHERE id = ANY(${recordIds}::text[])
            `;
        }

        const snippetMap = new Map(snippets.map(s => [s.id, s.content]));
        const taskKeyMap = new Map(snippets.map(s => [s.id, s.task_key]));

        const enriched = flags.map(f => ({
            id: f.id,
            similarityJobId: f.similarity_job_id,
            sourceRecordId: f.source_record_id,
            matchedRecordId: f.matched_record_id,
            similarityScore: Number(f.similarity_score),
            userEmail: f.user_email,
            userName: f.user_name,
            environment: f.environment,
            status: f.status,
            claimedByEmail: f.claimed_by_email,
            claimedAt: f.claimed_at,
            notifiedAt: f.notified_at,
            matchType: f.match_type,
            createdAt: f.created_at,
            sourceSnippet: snippetMap.get(f.source_record_id) ?? null,
            matchedSnippet: snippetMap.get(f.matched_record_id) ?? null,
            matchedTaskKey: f.match_type === 'DAILY_GREAT' ? (taskKeyMap.get(f.matched_record_id) ?? null) : null,
        }));

        return NextResponse.json({ flags: enriched, total, page, limit });
    } catch (error: any) {
        console.error('[similarity-flags] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
