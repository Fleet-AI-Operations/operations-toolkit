import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

type UserRole = 'PENDING' | 'USER' | 'QA' | 'CORE' | 'FLEET' | 'MANAGER' | 'ADMIN';
const ROLE_HIERARCHY: Record<UserRole, number> = {
  PENDING: 0, USER: 1, QA: 2, CORE: 3, FLEET: 4, MANAGER: 4, ADMIN: 5,
};
function hasPermission(userRole: string | null | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole as UserRole] ?? 0) >= ROLE_HIERARCHY[requiredRole];
}

/** Maximum allowed length for the q search parameter. */
const MAX_Q_LENGTH = 200;

/** Escapes SQL LIKE metacharacters so user input is treated as a literal string. */
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

type LookupRow = {
  id: string;
  createdByEmail: string; // guaranteed non-null — both query paths filter for IS NOT NULL
  createdByName: string | null;
  environment: string | null;
  taskKey: string | null;
};

type LookupResult = {
  recordId: string;
  email: string;
  name: string | null;
  environment: string | null;
  taskKey: string | null;
};

function toResult(r: LookupRow): LookupResult {
  return {
    recordId: r.id,
    email: r.createdByEmail,
    name: r.createdByName,
    environment: r.environment,
    taskKey: r.taskKey,
  };
}

/**
 * GET /api/prompt-authenticity/user-deep-dive/lookup?q=<task_key_or_id>
 *
 * Looks up the creator(s) of a task by record ID or metadata.task_key.
 * Only tasks with a non-null createdByEmail are considered; tasks ingested without
 * creator attribution will not appear in results.
 *
 * Requires authentication. Minimum role: CORE.
 *
 * Search strategy (in order):
 *   1. Exact match on record ID or metadata.task_key (case-sensitive, single OR query)
 *   2. Case-insensitive partial match on metadata.task_key (ILIKE '%q%'), up to 5 results
 *
 * Returns:
 *   200 { results: Array<{ recordId, email, name, environment, taskKey }>, matchType: 'exact' | 'fuzzy' }
 *   400 { error: 'q is required' }
 *   400 { error: 'q must be 200 characters or fewer' }
 *   401 { error: 'Unauthorized' }
 *   403 { error: 'Forbidden' }
 *   404 { error: 'No task found ...' }
 *   500 { error: 'Internal server error' }
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profileError) {
    console.error('[user-deep-dive/lookup] Failed to fetch user profile:', profileError);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  if (!profile || !hasPermission(profile.role, 'CORE')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q) {
    return NextResponse.json({ error: 'q is required' }, { status: 400 });
  }
  if (q.length > MAX_Q_LENGTH) {
    return NextResponse.json({ error: `q must be ${MAX_Q_LENGTH} characters or fewer` }, { status: 400 });
  }

  try {
    // ── Phase 1: exact match on record ID or metadata.task_key ──────────────
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
        results: [toResult({
          id: exact.id,
          createdByEmail: exact.createdByEmail,
          createdByName: exact.createdByName,
          environment: exact.environment,
          taskKey,
        })],
        matchType: 'exact',
      });
    }

    // ── Phase 2: fuzzy fallback — no exact match on record ID or task_key found ──
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

    return NextResponse.json({ results: fuzzy.map(toResult), matchType: 'fuzzy' });
  } catch (err: any) {
    console.error('[user-deep-dive/lookup] GET failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
