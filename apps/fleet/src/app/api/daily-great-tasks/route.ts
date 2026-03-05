import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

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
        console.error('[DailyGreatTasks] Failed to fetch profile for user', user.id, profileError);
        return { error: NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 }) };
    }

    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { user, profile };
}

/**
 * GET /api/daily-great-tasks?environment=X&page=1&limit=20
 * Returns paginated is_daily_great=true TASK records.
 * Auth: FLEET+
 */
export async function GET(request: NextRequest) {
    const authResult = await requireFleetAuth(request);
    if (authResult.error) return authResult.error;

    const { searchParams } = request.nextUrl;
    const environment = searchParams.get('environment') || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    try {
        type DailyGreatRow = {
            id: string;
            environment: string;
            created_by_name: string | null;
            created_by_email: string | null;
            created_at: Date;
            task_key: string | null;
            snippet: string;
        };

        const baseWhere = environment
            ? `WHERE is_daily_great = true AND type = 'TASK' AND environment = $1`
            : `WHERE is_daily_great = true AND type = 'TASK'`;

        let rows: DailyGreatRow[];
        let countResult: [{ count: bigint }];

        if (environment) {
            rows = await prisma.$queryRaw`
                SELECT
                    id,
                    environment,
                    "createdByName" AS created_by_name,
                    "createdByEmail" AS created_by_email,
                    "createdAt" AS created_at,
                    metadata->>'task_key' AS task_key,
                    SUBSTRING(content FROM 1 FOR 200) AS snippet
                FROM public.data_records
                WHERE is_daily_great = true AND type = 'TASK' AND environment = ${environment}
                ORDER BY "createdAt" DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) AS count FROM public.data_records
                WHERE is_daily_great = true AND type = 'TASK' AND environment = ${environment}
            `;
        } else {
            rows = await prisma.$queryRaw`
                SELECT
                    id,
                    environment,
                    "createdByName" AS created_by_name,
                    "createdByEmail" AS created_by_email,
                    "createdAt" AS created_at,
                    metadata->>'task_key' AS task_key,
                    SUBSTRING(content FROM 1 FOR 200) AS snippet
                FROM public.data_records
                WHERE is_daily_great = true AND type = 'TASK'
                ORDER BY "createdAt" DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await prisma.$queryRaw`
                SELECT COUNT(*) AS count FROM public.data_records
                WHERE is_daily_great = true AND type = 'TASK'
            `;
        }

        const total = Number(countResult[0].count);
        const records = rows.map(r => ({
            id: r.id,
            environment: r.environment,
            createdByName: r.created_by_name,
            createdByEmail: r.created_by_email,
            createdAt: r.created_at,
            taskKey: r.task_key,
            snippet: r.snippet,
        }));

        return NextResponse.json({ records, total, page, limit });
    } catch (err) {
        console.error('[DailyGreatTasks] GET error:', err);
        return NextResponse.json({ error: 'Failed to fetch daily great tasks' }, { status: 500 });
    }
}

/**
 * PATCH /api/daily-great-tasks/[id] is handled by the [id] route.
 * This base route does not handle PATCH.
 */
