import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { requireRole } from '@repo/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/task-disputes
 *
 * Returns paginated disputes and summary stats.
 *
 * Query params:
 *   page          (optional, default 1)
 *   limit         (optional, default 50, max 200)
 *   status        (optional) — filter by dispute_status
 *   env           (optional) — filter by env_key
 *   search        (optional) — case-insensitive contains across disputer/QA reviewer/resolver name and email (max 200 chars)
 *   modality      (optional) — filter by task_modality
 *   matched       (optional) — 'true' | 'false' — filter by whether eval_task_id is linked
 *   taskKey       (optional) — case-insensitive substring filter on task_key
 */
export async function GET(req: NextRequest) {
  const authResult = await requireRole(req, ['FLEET', 'ADMIN']);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const status = searchParams.get('status') || null;
    const env = searchParams.get('env') || null;
    const search = (searchParams.get('search') || '').slice(0, 200) || null;
    const modality = searchParams.get('modality') || null;
    const matchedParam = searchParams.get('matched');
    const taskKey = searchParams.get('taskKey') || null;

    const where: Record<string, unknown> = {};
    if (status) where.disputeStatus = status;
    if (env) where.envKey = env;
    if (search) {
      where.OR = [
        { disputerName: { contains: search, mode: 'insensitive' } },
        { disputerEmail: { contains: search, mode: 'insensitive' } },
        { qaReviewerName: { contains: search, mode: 'insensitive' } },
        { qaReviewerEmail: { contains: search, mode: 'insensitive' } },
        { resolverName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (modality) where.taskModality = modality;
    if (matchedParam === 'true') where.evalTaskId = { not: null };
    if (matchedParam === 'false') where.evalTaskId = null;
    if (taskKey) where.taskKey = { contains: taskKey, mode: 'insensitive' };

    const [disputes, total, statusCounts, envCounts, modalityCounts, matchedCount, grandTotal] = await Promise.all([
      prisma.taskDispute.findMany({
        where,
        orderBy: [{ createdAtSource: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
        include: {
          dataRecord: {
            select: { id: true, environment: true, createdByEmail: true, createdByName: true },
          },
        },
      }),
      prisma.taskDispute.count({ where }),
      prisma.taskDispute.groupBy({
        by: ['disputeStatus'],
        _count: { _all: true },
      }),
      prisma.taskDispute.groupBy({
        by: ['envKey'],
        _count: { _all: true },
        orderBy: { _count: { envKey: 'desc' } },
      }),
      prisma.taskDispute.groupBy({
        by: ['taskModality'],
        _count: { _all: true },
      }),
      prisma.taskDispute.count({ where: { evalTaskId: { not: null } } }),
      prisma.taskDispute.count(),
    ]);

    return NextResponse.json({
      disputes,
      total,
      page,
      limit,
      stats: {
        byStatus: Object.fromEntries(statusCounts.map(r => [r.disputeStatus, r._count._all])),
        byEnv: envCounts
          .filter(r => r.envKey)
          .map(r => ({ env: r.envKey as string, count: r._count._all })),
        byModality: Object.fromEntries(modalityCounts.map(r => [r.taskModality ?? 'unknown', r._count._all])),
        totalMatched: matchedCount,
        totalUnmatched: grandTotal - matchedCount,
      },
    });
  } catch (err) {
    console.error('[task-disputes] GET failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
