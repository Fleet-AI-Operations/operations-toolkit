import { NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';

const ADMIN_ROLES = ['ADMIN'] as const;
const MANAGER_OR_ABOVE = ['MANAGER', 'ADMIN'] as const;

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Require the caller to be authenticated with ADMIN role.
 * Returns `{ user }` on success or `{ error: NextResponse }` on failure.
 */
export async function requireAdminRole(): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('[requireAdminRole] Failed to fetch profile for userId:', user.id, profileError);
  }
  if (profileError || !profile || !ADMIN_ROLES.includes(profile.role as typeof ADMIN_ROLES[number])) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user: { id: user.id, email: user.email ?? '', role: profile.role } };
}

/**
 * Require the caller to be authenticated with MANAGER or ADMIN role.
 * Returns `{ user }` on success or `{ error: NextResponse }` on failure.
 */
export async function requireManagerRole(): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('[requireManagerRole] Failed to fetch profile for userId:', user.id, profileError);
  }
  if (profileError || !profile || !MANAGER_OR_ABOVE.includes(profile.role as typeof MANAGER_OR_ABOVE[number])) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user: { id: user.id, email: user.email ?? '', role: profile.role } };
}
