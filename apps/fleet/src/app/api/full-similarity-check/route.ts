import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { Prisma } from '@prisma/client';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check user has FLEET or higher role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const environment = searchParams.get('environment');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '25', 10);
        const userFilter = searchParams.get('user');
        const latestOnly = searchParams.get('latestOnly') === 'true';

        // Build environment/user filter fragments for raw queries
        const envFilter = environment ? Prisma.sql`AND LOWER(environment) = LOWER(${environment})` : Prisma.empty;
        const userFilterSql = userFilter
            ? Prisma.sql`AND ("createdByName" = ${userFilter} OR "createdByEmail" = ${userFilter})`
            : Prisma.empty;

        // Count only tasks with embeddings (these are the only ones comparable)
        let totalCount: number;
        if (latestOnly) {
            const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count FROM (
                    SELECT DISTINCT ON (COALESCE(metadata->>'task_key', id)) id
                    FROM data_records
                    WHERE type = 'TASK'
                    AND embedding IS NOT NULL
                    ${envFilter}
                    ${userFilterSql}
                    ORDER BY COALESCE(metadata->>'task_key', id),
                             CAST(COALESCE(NULLIF(metadata->>'task_version', ''), NULLIF(metadata->>'version_no', ''), '0') AS INTEGER) DESC,
                             "createdAt" DESC
                ) latest
            `;
            totalCount = Number(countResult[0]?.count ?? 0);
        } else {
            const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count
                FROM data_records
                WHERE type = 'TASK'
                AND embedding IS NOT NULL
                ${envFilter}
                ${userFilterSql}
            `;
            totalCount = Number(countResult[0]?.count ?? 0);
        }

        // Calculate pagination
        const skip = (page - 1) * limit;
        const totalPages = Math.ceil(totalCount / limit);

        // Fetch paginated tasks that have embeddings
        type TaskRow = {
            id: string;
            content: string;
            environment: string;
            metadata: any;
            createdByName: string | null;
            createdByEmail: string | null;
            createdAt: Date;
        };

        let tasks: TaskRow[];
        if (latestOnly) {
            tasks = await prisma.$queryRaw<TaskRow[]>`
                SELECT id, content, environment, metadata, "createdByName", "createdByEmail", "createdAt"
                FROM (
                    SELECT DISTINCT ON (COALESCE(metadata->>'task_key', id))
                        id, content, environment, metadata, "createdByName", "createdByEmail", "createdAt"
                    FROM data_records
                    WHERE type = 'TASK'
                    AND embedding IS NOT NULL
                    ${envFilter}
                    ${userFilterSql}
                    ORDER BY COALESCE(metadata->>'task_key', id),
                             CAST(COALESCE(NULLIF(metadata->>'task_version', ''), NULLIF(metadata->>'version_no', ''), '0') AS INTEGER) DESC,
                             "createdAt" DESC
                ) latest
                ORDER BY "createdAt" DESC
                LIMIT ${limit} OFFSET ${skip}
            `;
        } else {
            tasks = await prisma.$queryRaw<TaskRow[]>`
                SELECT id, content, environment, metadata, "createdByName", "createdByEmail", "createdAt"
                FROM data_records
                WHERE type = 'TASK'
                AND embedding IS NOT NULL
                ${envFilter}
                ${userFilterSql}
                ORDER BY "createdAt" DESC
                LIMIT ${limit} OFFSET ${skip}
            `;
        }

        // Format the response
        const formattedTasks = tasks.map(task => ({
            id: task.id,
            content: task.content,
            environment: task.environment || 'N/A',
            createdBy: task.createdByName || task.createdByEmail || 'Unknown',
            createdAt: task.createdAt,
        }));

        return NextResponse.json({
            tasks: formattedTasks,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasMore: page < totalPages
            }
        });
    } catch (error: any) {
        console.error('Error fetching tasks:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
