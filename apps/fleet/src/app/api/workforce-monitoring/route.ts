import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { Prisma } from '@prisma/client';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

type WorkerRow = {
  email: string;
  name: string | null;
  taskCount: bigint;
  feedbackCount: bigint;
  activeFlags: bigint;
  lastActivity: Date | null;
};

type SortCol = 'lastActivity' | 'taskCount' | 'feedbackCount' | 'activeFlags';

const SORT_SQL: Record<SortCol, string> = {
  lastActivity:  'MAX("createdAt")',
  taskCount:     'COUNT(*) FILTER (WHERE type = \'TASK\')',
  feedbackCount: 'COUNT(*) FILTER (WHERE type = \'FEEDBACK\')',
  activeFlags:   '"activeFlags"',
};

// Default sort: flagged workers first, then alphabetically by last name, then by email.
// Last name is extracted by stripping everything up to and including the last space.
const DEFAULT_ORDER = `"activeFlags" DESC NULLS LAST, LOWER(REGEXP_REPLACE(MAX(dr."createdByName"), '^.+\\s+', '')) ASC NULLS LAST, LOWER(dr."createdByEmail") ASC`;

/**
 * GET /api/workforce-monitoring
 *
 * Returns paginated workers (anyone who has submitted tasks or feedback) with
 * aggregate counts and active flag totals.
 *
 * Requires FLEET or higher role.
 *
 * Query params:
 *   environment  (optional) — filter to a specific environment
 *   search       (optional) — case-insensitive partial match on name or email
 *   page         (optional, default 1)
 *   limit        (optional, default 50, max 200)
 *   sortBy       (optional) — lastActivity | taskCount | feedbackCount | activeFlags
 *   sortDir      (optional) — asc | desc (default desc)
 *
 * Returns:
 *   200 { workers, total, page, limit }
 *   401 Unauthorized
 *   403 Forbidden
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
    const environment = searchParams.get('environment')?.trim() || null;
    const search      = searchParams.get('search')?.trim() || null;
    const page        = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit       = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(searchParams.get('limit') || String(PAGE_SIZE_DEFAULT), 10)));
    const sortByRaw   = searchParams.get('sortBy') || null;
    const sortDir     = searchParams.get('sortDir') === 'asc' ? 'ASC' : 'DESC';
    const flaggedRaw  = searchParams.get('flagged') || 'all';
    const flagged     = (['all', 'flagged', 'unflagged'] as const).includes(flaggedRaw as 'all' | 'flagged' | 'unflagged')
      ? (flaggedRaw as 'all' | 'flagged' | 'unflagged')
      : 'all';

    const sortBy: SortCol | null = (sortByRaw && sortByRaw in SORT_SQL) ? (sortByRaw as SortCol) : null;
    const orderExpr = sortBy ? Prisma.raw(`${SORT_SQL[sortBy]} ${sortDir}`) : Prisma.raw(DEFAULT_ORDER);

    const envFilter = environment ? Prisma.sql`AND LOWER(dr.environment) = LOWER(${environment})` : Prisma.empty;
    // Search HAVING fragment: email can be filtered pre-GROUP-BY but name requires MAX() so both go in HAVING.
    const searchHaving = search
      ? Prisma.sql`AND (LOWER(dr."createdByEmail") LIKE LOWER(${`%${search}%`}) OR LOWER(MAX(dr."createdByName")) LIKE LOWER(${`%${search}%`}))`
      : Prisma.empty;
    // Flagged/unflagged HAVING fragment: filters on the active-flag subquery result.
    const flaggedHaving = flagged === 'flagged'
      ? Prisma.sql`AND (SELECT COUNT(*) FROM worker_flags wf WHERE wf.worker_email = dr."createdByEmail" AND wf.status IN ('OPEN', 'UNDER_REVIEW')) > 0`
      : flagged === 'unflagged'
      ? Prisma.sql`AND (SELECT COUNT(*) FROM worker_flags wf WHERE wf.worker_email = dr."createdByEmail" AND wf.status IN ('OPEN', 'UNDER_REVIEW')) = 0`
      : Prisma.empty;

    const countRows = await prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total FROM (
        SELECT dr."createdByEmail"
        FROM data_records dr
        WHERE dr."createdByEmail" IS NOT NULL
          ${envFilter}
        GROUP BY dr."createdByEmail"
        HAVING TRUE ${searchHaving} ${flaggedHaving}
      ) AS worker_count
    `;

    const total = Number(countRows[0]?.total ?? 0);
    const offset = (page - 1) * limit;

    const rows = await prisma.$queryRaw<WorkerRow[]>`
      SELECT
        dr."createdByEmail"                                    AS email,
        MAX(dr."createdByName")                                AS name,
        COUNT(*) FILTER (WHERE dr.type = 'TASK')               AS "taskCount",
        COUNT(*) FILTER (WHERE dr.type = 'FEEDBACK')           AS "feedbackCount",
        MAX(dr."createdAt")                                    AS "lastActivity",
        COALESCE((
          SELECT COUNT(*) FROM worker_flags wf
          WHERE wf.worker_email = dr."createdByEmail"
            AND wf.status IN ('OPEN', 'UNDER_REVIEW')
        ), 0)                                                  AS "activeFlags"
      FROM data_records dr
      WHERE dr."createdByEmail" IS NOT NULL
        ${envFilter}
      GROUP BY dr."createdByEmail"
      HAVING TRUE ${searchHaving} ${flaggedHaving}
      ORDER BY ${orderExpr}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const workers = rows.map(row => ({
      email: row.email,
      name: row.name,
      taskCount: Number(row.taskCount),
      feedbackCount: Number(row.feedbackCount),
      activeFlags: Number(row.activeFlags),
      lastActivity: row.lastActivity,
    }));

    return NextResponse.json({ workers, total, page, limit });
  } catch (err) {
    console.error('[workforce-monitoring] GET failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
