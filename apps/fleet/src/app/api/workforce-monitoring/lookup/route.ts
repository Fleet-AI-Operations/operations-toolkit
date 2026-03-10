import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

const MAX_Q_LENGTH = 200;

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

type LookupRow = {
  id: string;
  createdByEmail: string;
  createdByName: string | null;
  environment: string | null;
  taskKey: string | null;
};

/**
 * GET /api/workforce-monitoring/lookup?q=<task_key_or_id>
 *
 * Looks up the creator of a task by record ID or metadata.task_key.
 * Identical search logic to the Core app's user-deep-dive/lookup endpoint,
 * but requires FLEET or higher role.
 *
 * Returns:
 *   200 { results: Array<{ recordId, email, name, environment, taskKey }>, matchType: 'exact' | 'fuzzy' }
 *   400 q is required / q too long
 *   401 Unauthorized
 *   403 Forbidden
 *   404 No task found
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
    const q = searchParams.get('q')?.trim();

    if (!q) {
      return NextResponse.json({ error: 'q is required' }, { status: 400 });
    }
    if (q.length > MAX_Q_LENGTH) {
      return NextResponse.json({ error: `q must be ${MAX_Q_LENGTH} characters or fewer` }, { status: 400 });
    }

    // Phase 1: exact match on record ID or metadata.task_key
    const exact = await prisma.dataRecord.findFirst({
      where: {
        type: 'TASK',
        createdByEmail: { not: null },
        OR: [
          { id: q },
          { metadata: { path: ['task_key'], equals: q } },
        ],
      },
      select: {
        id: true,
        createdByEmail: true,
        createdByName: true,
        environment: true,
        metadata: true,
      },
    });

    if (exact?.createdByEmail) {
      const taskKey = (exact.metadata as Record<string, any> | null)?.task_key ?? null;
      return NextResponse.json({
        results: [{
          recordId: exact.id,
          email: exact.createdByEmail,
          name: exact.createdByName,
          environment: exact.environment,
          taskKey,
        }],
        matchType: 'exact',
      });
    }

    // Phase 2: fuzzy ILIKE fallback
    const pattern = '%' + escapeLike(q) + '%';
    const fuzzy = await prisma.$queryRaw<LookupRow[]>`
      SELECT
        id,
        "createdByEmail",
        "createdByName",
        environment,
        metadata->>'task_key' AS "taskKey"
      FROM data_records
      WHERE type = 'TASK'
        AND "createdByEmail" IS NOT NULL
        AND metadata->>'task_key' ILIKE ${pattern}
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;

    if (fuzzy.length === 0) {
      return NextResponse.json({ error: 'No task found for the given ID or task key' }, { status: 404 });
    }

    return NextResponse.json({
      results: fuzzy.map(r => ({
        recordId: r.id,
        email: r.createdByEmail,
        name: r.createdByName,
        environment: r.environment,
        taskKey: r.taskKey,
      })),
      matchType: 'fuzzy',
    });
  } catch (err) {
    console.error('[workforce-monitoring/lookup] GET failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
