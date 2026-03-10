import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { Prisma } from '@prisma/client';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

type TaskRow = {
  id: string;
  environment: string;
  content: string;
  metadata: unknown;
  createdAt: Date;
  alignmentAnalysis: string | null;
  hasBeenReviewed: boolean;
};

/**
 * GET /api/workforce-monitoring/worker?email=<email>
 *
 * Returns a worker's tasks, feedback, and active flags.
 *
 * Requires FLEET or higher role.
 *
 * Query params:
 *   email        (required) — worker email address
 *   environment  (optional) — filter records to a specific environment
 *   page         (optional, default 1) — page number for records
 *   limit        (optional, default 50) — records per page (max 100)
 *   type         (optional) — 'TASK' | 'FEEDBACK' — filter record type
 *   latestOnly   (optional) — 'true' — for tasks, deduplicate by task_key keeping the highest version
 *
 * Returns:
 *   200 { worker: { email, name }, tasks, feedback, flags, totalTasks, totalFeedback, environments }
 *   400 email is required
 *   401 Unauthorized
 *   403 Forbidden
 *   404 worker not found
 *   500 Internal server error
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
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const environment = searchParams.get('environment')?.trim() || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const typeFilter = searchParams.get('type') as 'TASK' | 'FEEDBACK' | null;
    const latestOnly = searchParams.get('latestOnly') === 'true';

    const skip = (page - 1) * limit;

    const envFilter = environment ? Prisma.sql`AND LOWER(environment) = LOWER(${environment})` : Prisma.empty;

    // ── Tasks ────────────────────────────────────────────────────────────────
    let tasks: TaskRow[] = [];
    let totalTasks = 0;

    if (typeFilter !== 'FEEDBACK') {
      if (latestOnly) {
        // Deduplicate by task_key, keeping the highest version per key
        const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) AS count FROM (
            SELECT DISTINCT ON (COALESCE(metadata->>'task_key', id)) id
            FROM data_records
            WHERE type = 'TASK'
              AND "createdByEmail" = ${email}
              ${envFilter}
            ORDER BY COALESCE(metadata->>'task_key', id),
                     CAST(COALESCE(NULLIF(metadata->>'task_version', ''), NULLIF(metadata->>'version_no', ''), '0') AS INTEGER) DESC,
                     "createdAt" DESC
          ) latest
        `;
        totalTasks = Number(countResult[0]?.count ?? 0);

        tasks = await prisma.$queryRaw<TaskRow[]>`
          SELECT id, environment, content, metadata, "createdAt", "alignmentAnalysis", "hasBeenReviewed"
          FROM (
            SELECT DISTINCT ON (COALESCE(metadata->>'task_key', id))
              id, environment, content, metadata, "createdAt", "alignmentAnalysis", "hasBeenReviewed"
            FROM data_records
            WHERE type = 'TASK'
              AND "createdByEmail" = ${email}
              ${envFilter}
            ORDER BY COALESCE(metadata->>'task_key', id),
                     CAST(COALESCE(NULLIF(metadata->>'task_version', ''), NULLIF(metadata->>'version_no', ''), '0') AS INTEGER) DESC,
                     "createdAt" DESC
          ) latest
          ORDER BY "createdAt" DESC
          LIMIT ${limit} OFFSET ${skip}
        `;
      } else {
        [tasks, totalTasks] = await Promise.all([
          prisma.$queryRaw<TaskRow[]>`
            SELECT id, environment, content, metadata, "createdAt", "alignmentAnalysis", "hasBeenReviewed"
            FROM data_records
            WHERE type = 'TASK'
              AND "createdByEmail" = ${email}
              ${envFilter}
            ORDER BY "createdAt" DESC
            LIMIT ${limit} OFFSET ${skip}
          `,
          prisma.dataRecord.count({
            where: { createdByEmail: email, type: 'TASK', ...(environment ? { environment } : {}) },
          }),
        ]);
      }
    }

    // ── Feedback ─────────────────────────────────────────────────────────────
    const [feedback, totalFeedback] = typeFilter === 'TASK'
      ? [[], 0]
      : await Promise.all([
          prisma.dataRecord.findMany({
            where: { createdByEmail: email, type: 'FEEDBACK', ...(environment ? { environment } : {}) },
            select: { id: true, environment: true, content: true, metadata: true, createdAt: true, alignmentAnalysis: true, hasBeenReviewed: true },
            orderBy: { createdAt: 'desc' },
            skip: typeFilter === 'FEEDBACK' ? skip : 0,
            take: typeFilter === 'FEEDBACK' ? limit : 50,
          }),
          prisma.dataRecord.count({
            where: { createdByEmail: email, type: 'FEEDBACK', ...(environment ? { environment } : {}) },
          }),
        ]);

    // ── Flags ─────────────────────────────────────────────────────────────────
    const flags = await prisma.workerFlag.findMany({
      where: { workerEmail: email },
      orderBy: { createdAt: 'desc' },
    });

    // ── Worker meta (name + distinct environments, always unfiltered) ─────────
    const [sampleRecord, envRows] = await Promise.all([
      prisma.dataRecord.findFirst({
        where: { createdByEmail: email },
        select: { createdByName: true },
      }),
      prisma.dataRecord.groupBy({
        by: ['environment'],
        where: { createdByEmail: email },
        _count: { _all: true },
        orderBy: { environment: 'asc' },
      }),
    ]);

    if (!sampleRecord && tasks.length === 0 && feedback.length === 0) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    return NextResponse.json({
      worker: { email, name: sampleRecord?.createdByName ?? null },
      tasks,
      feedback,
      flags,
      totalTasks,
      totalFeedback,
      environments: envRows
        .filter(r => r.environment)
        .map(r => ({ name: r.environment as string, count: r._count._all })),
    });
  } catch (err) {
    console.error('[workforce-monitoring/worker] GET failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
