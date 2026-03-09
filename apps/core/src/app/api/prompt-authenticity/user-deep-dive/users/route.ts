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

/**
 * GET /api/prompt-authenticity/user-deep-dive/users?environment=...
 *
 * Returns a list of distinct task creators from DataRecord,
 * with task counts, for the user selector on the deep-dive landing page.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profileError) {
    console.error('[user-deep-dive/users] Failed to fetch user profile:', profileError);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  if (!profile || !hasPermission(profile.role, 'CORE')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || undefined;

    const where: any = {
      type: 'TASK',
      createdByEmail: { not: null },
      NOT: { createdByEmail: { endsWith: '@fleet.so', mode: 'insensitive' } },
    };
    if (environment) where.environment = environment;

    // take guard: prevents OOM on large datasets; 10 000 unique emails is well
    // above any realistic deployment size for this tool.
    const records = await prisma.dataRecord.findMany({
      where,
      select: { createdByEmail: true, createdByName: true },
      take: 10_000,
    });

    // Aggregate by email
    const map = new Map<string, { email: string; name: string | null; taskCount: number }>();
    for (const r of records) {
      if (!r.createdByEmail) continue;
      const key = r.createdByEmail.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { email: r.createdByEmail, name: r.createdByName ?? null, taskCount: 0 });
      }
      map.get(key)!.taskCount++;
    }

    const users = Array.from(map.values()).sort((a, b) => {
      const aName = a.name ?? a.email;
      const bName = b.name ?? b.email;
      return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('[user-deep-dive/users] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load users', details: error.message }, { status: 500 });
  }
}
