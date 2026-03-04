import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';

/**
 * GET /api/task-search?q=<query>
 * Search TASK records by creator name, creator email, or exact task ID.
 * Returns up to 25 matches.
 */
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

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
        console.error('[TaskSearch] Failed to fetch profile for user', user.id, profileErr);
        return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
    }

    if (!profile || !['CORE', 'FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';

    if (!q) {
        return NextResponse.json({ tasks: [] });
    }

    try {
        const tasks = await prisma.$queryRaw<Array<{
            id: string;
            content: string;
            environment: string;
            createdByName: string | null;
            createdByEmail: string | null;
            createdAt: Date;
            taskKey: string | null;
            taskVersion: string | null;
        }>>`
            SELECT id, content, environment, "createdByName", "createdByEmail", "createdAt",
                   metadata->>'task_key' AS "taskKey",
                   metadata->>'task_version' AS "taskVersion"
            FROM data_records
            WHERE type = 'TASK'
            AND (
                id = ${q}
                OR metadata->>'task_key' = ${q}
                OR metadata->>'task_id' = ${q}
                OR "createdByName" ILIKE ${'%' + q + '%'}
                OR "createdByEmail" ILIKE ${'%' + q + '%'}
            )
            ORDER BY "createdAt" DESC
            LIMIT 25
        `;

        return NextResponse.json({ tasks });
    } catch (error: any) {
        console.error(`[TaskSearch] Search query failed. Query: "${q}"`, error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
