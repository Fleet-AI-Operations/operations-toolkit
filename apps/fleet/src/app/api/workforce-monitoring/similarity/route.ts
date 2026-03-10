import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { Prisma } from '@prisma/client';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workforce-monitoring/similarity?email=...&environment=...&page=...&limit=...&latestOnly=...
 *
 * Returns a worker's tasks that have embeddings (required for similarity comparison).
 * Requires FLEET or higher role.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email')?.trim();
    if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

    const environment = searchParams.get('environment')?.trim() || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const latestOnly = searchParams.get('latestOnly') === 'true';
    const skip = (page - 1) * limit;

    const envFilter = environment ? Prisma.sql`AND LOWER(environment) = LOWER(${environment})` : Prisma.empty;

    type TaskRow = {
      id: string;
      content: string;
      environment: string | null;
      metadata: any;
      createdAt: Date;
    };

    let totalCount: number;
    let tasks: TaskRow[];

    if (latestOnly) {
      const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count FROM (
          SELECT DISTINCT ON (COALESCE(metadata->>'task_key', id)) id
          FROM data_records
          WHERE type = 'TASK'
            AND "createdByEmail" = ${email}
            AND embedding IS NOT NULL
            ${envFilter}
          ORDER BY COALESCE(metadata->>'task_key', id),
                   CAST(COALESCE(NULLIF(metadata->>'task_version', ''), NULLIF(metadata->>'version_no', ''), '0') AS INTEGER) DESC,
                   "createdAt" DESC
        ) latest
      `;
      totalCount = Number(countResult[0]?.count ?? 0);

      tasks = await prisma.$queryRaw<TaskRow[]>`
        SELECT id, content, environment, metadata, "createdAt"
        FROM (
          SELECT DISTINCT ON (COALESCE(metadata->>'task_key', id))
            id, content, environment, metadata, "createdAt"
          FROM data_records
          WHERE type = 'TASK'
            AND "createdByEmail" = ${email}
            AND embedding IS NOT NULL
            ${envFilter}
          ORDER BY COALESCE(metadata->>'task_key', id),
                   CAST(COALESCE(NULLIF(metadata->>'task_version', ''), NULLIF(metadata->>'version_no', ''), '0') AS INTEGER) DESC,
                   "createdAt" DESC
        ) latest
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `;
    } else {
      const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM data_records
        WHERE type = 'TASK'
          AND "createdByEmail" = ${email}
          AND embedding IS NOT NULL
          ${envFilter}
      `;
      totalCount = Number(countResult[0]?.count ?? 0);

      tasks = await prisma.$queryRaw<TaskRow[]>`
        SELECT id, content, environment, metadata, "createdAt"
        FROM data_records
        WHERE type = 'TASK'
          AND "createdByEmail" = ${email}
          AND embedding IS NOT NULL
          ${envFilter}
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `;
    }

    return NextResponse.json({
      tasks: tasks.map(t => ({
        id: t.id,
        content: t.content,
        environment: t.environment ?? null,
        taskKey: (t.metadata as any)?.task_key ?? null,
        createdAt: t.createdAt,
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    });
  } catch (err) {
    console.error('[workforce-monitoring/similarity] GET failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
