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
 * GET /api/prompt-authenticity/user-deep-dive/lookup?q=<task_key_or_id>
 *
 * Looks up the creator of a task by its record ID or metadata.task_key.
 * Returns creator email, name, and environment so the caller can navigate
 * directly to that user's deep dive.
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
    const record = await prisma.dataRecord.findFirst({
      where: {
        type: 'TASK',
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
      },
    });

    if (!record || !record.createdByEmail) {
      return NextResponse.json({ error: 'No task found for the given ID or task key' }, { status: 404 });
    }

    return NextResponse.json({
      recordId: record.id,
      email: record.createdByEmail,
      name: record.createdByName ?? null,
      environment: record.environment ?? null,
    });
  } catch (error: any) {
    console.error('[user-deep-dive/lookup] GET failed:', error);
    return NextResponse.json({ error: 'Lookup failed', details: error.message }, { status: 500 });
  }
}
