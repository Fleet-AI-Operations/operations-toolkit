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
        console.error('[DailyGreatTasks/Search] Failed to fetch profile for user', user.id, profileError);
        return { error: NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 }) };
    }

    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { user, profile };
}

/**
 * GET /api/daily-great-tasks/search?task_key=X
 * Finds TASK records where metadata->>'task_key' = X.
 * Returns: id, environment, taskKey, snippet, isDailyGreat, createdByName, createdAt
 * Auth: FLEET+
 */
export async function GET(request: NextRequest) {
    const authResult = await requireFleetAuth(request);
    if (authResult.error) return authResult.error;

    const taskKey = request.nextUrl.searchParams.get('task_key');

    if (!taskKey?.trim()) {
        return NextResponse.json({ error: 'task_key query parameter is required' }, { status: 400 });
    }

    try {
        type SearchRow = {
            id: string;
            environment: string;
            task_key: string | null;
            snippet: string;
            is_daily_great: boolean;
            created_by_name: string | null;
            created_by_email: string | null;
            created_at: Date;
        };

        const rows: SearchRow[] = await prisma.$queryRaw`
            WITH ranked AS (
                SELECT
                    id,
                    environment,
                    metadata->>'task_key' AS task_key,
                    SUBSTRING(content FROM 1 FOR 200) AS snippet,
                    is_daily_great,
                    "createdByName" AS created_by_name,
                    "createdByEmail" AS created_by_email,
                    "createdAt" AS created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY "createdByEmail"
                        ORDER BY "createdAt" DESC
                    ) AS rn
                FROM public.data_records
                WHERE type = 'TASK'
                AND metadata->>'task_key' = ${taskKey.trim()}
                AND "createdByEmail" NOT ILIKE '%@fleet.io'
                AND "createdByEmail" NOT ILIKE '%@fleet.so'
            )
            SELECT id, environment, task_key, snippet, is_daily_great, created_by_name, created_by_email, created_at
            FROM ranked
            WHERE rn = 1
            ORDER BY created_at DESC
            LIMIT 50
        `;

        const records = rows.map(r => ({
            id: r.id,
            environment: r.environment,
            taskKey: r.task_key,
            snippet: r.snippet,
            isDailyGreat: r.is_daily_great,
            createdByName: r.created_by_name,
            createdByEmail: r.created_by_email,
            createdAt: r.created_at,
        }));

        return NextResponse.json({ records });
    } catch (err) {
        console.error('[DailyGreatTasks/Search] GET error:', err);
        return NextResponse.json({ error: 'Failed to search records' }, { status: 500 });
    }
}
