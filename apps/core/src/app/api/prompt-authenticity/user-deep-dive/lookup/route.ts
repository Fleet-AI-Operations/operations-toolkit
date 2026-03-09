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

type LookupRow = {
  id: string;
  createdByEmail: string | null;
  createdByName: string | null;
  environment: string | null;
  taskKey: string | null;
};

function toResult(r: LookupRow) {
  return {
    recordId: r.id,
    email: r.createdByEmail,
    name: r.createdByName ?? null,
    environment: r.environment ?? null,
    taskKey: r.taskKey ?? null,
  };
}

/**
 * GET /api/prompt-authenticity/user-deep-dive/lookup?q=<task_key_or_id>
 *
 * Looks up the creator(s) of a task by record ID or metadata.task_key.
 *
 * Search strategy (in order):
 *   1. Exact match on record ID
 *   2. Exact match on metadata.task_key (case-sensitive)
 *   3. Case-insensitive partial match on metadata.task_key (ILIKE '%q%'), up to 5 results
 *
 * Returns: { results: Array<{ recordId, email, name, environment, taskKey }> }
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

  try {
    // ── Phase 1: exact match ────────────────────────────────────────────────
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
      return NextResponse.json({ results: [toResult({ ...exact, taskKey })] });
    }

    // ── Phase 2: case-insensitive partial match on metadata.task_key ────────
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
        AND LOWER(metadata->>'task_key') LIKE LOWER(${'%' + q + '%'})
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;

    if (fuzzy.length === 0) {
      return NextResponse.json({ error: 'No task found for the given ID or task key' }, { status: 404 });
    }

    return NextResponse.json({ results: fuzzy.map(toResult) });
  } catch (error: any) {
    console.error('[user-deep-dive/lookup] GET failed:', error);
    return NextResponse.json({ error: 'Lookup failed', details: error.message }, { status: 500 });
  }
}
