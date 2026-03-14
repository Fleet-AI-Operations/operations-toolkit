import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { getUserRole, authenticateWithToken } from '@repo/auth/utils';
import type { UserRole } from '@repo/types';

export interface AuthSuccess {
  user: {
    id: string;
    email: string;
  };
  error: null;
}

export interface AuthError {
  user: null;
  error: NextResponse;
}

export type AuthResult = AuthSuccess | AuthError;

export interface RoleAuthSuccess {
  user: {
    id: string;
    email: string;
  };
  role: UserRole;
  error: null;
}

export interface RoleAuthError {
  user: null;
  role: null;
  error: NextResponse;
}

export type RoleAuthResult = RoleAuthSuccess | RoleAuthError;

/**
 * Require authentication for API routes.
 * Checks Bearer token in Authorization header first, then falls back to Supabase session.
 * Returns user or error response.
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const tokenValue = authHeader.slice(7);
    const tokenUser = await authenticateWithToken(tokenValue);
    if (tokenUser) {
      return { user: tokenUser, error: null };
    }
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email
    },
    error: null
  };
}

/**
 * Require specific role(s) for API routes
 * Returns user, role, or error response
 */
export async function requireRole(
  req: NextRequest,
  roles: UserRole[]
): Promise<RoleAuthResult> {
  const authResult = await requireAuth(req);

  if (authResult.error) {
    return {
      user: null,
      role: null,
      error: authResult.error
    };
  }

  const role = await getUserRole(authResult.user.id);

  if (!roles.includes(role)) {
    return {
      user: null,
      role: null,
      error: NextResponse.json(
        { error: `Forbidden - ${roles.join(' or ')} role required` },
        { status: 403 }
      )
    };
  }

  return {
    user: authResult.user,
    role,
    error: null
  };
}

const ROLE_WEIGHTS: Record<UserRole, number> = {
  PENDING: 0,
  USER: 1,
  QA: 2,
  CORE: 3,
  FLEET: 4,
  MANAGER: 4,
  ADMIN: 5,
};

/**
 * Require a minimum role (hierarchical). Any role >= minRole is accepted.
 * ADMIN > MANAGER/FLEET > CORE > QA > USER > PENDING
 *
 * Note: MANAGER and FLEET share the same weight (4), so requireMinRole(req, 'FLEET')
 * also admits MANAGER users and vice versa. Use requireRole() with an explicit list
 * if you need to distinguish between them.
 */
export async function requireMinRole(
  req: NextRequest,
  minRole: UserRole
): Promise<RoleAuthResult> {
  const authResult = await requireAuth(req);

  if (authResult.error) {
    return { user: null, role: null, error: authResult.error };
  }

  const role = await getUserRole(authResult.user.id);

  if ((ROLE_WEIGHTS[role] ?? 0) < (ROLE_WEIGHTS[minRole] ?? 0)) {
    return {
      user: null,
      role: null,
      error: NextResponse.json(
        { error: 'Forbidden - insufficient role' },
        { status: 403 }
      )
    };
  }

  return { user: authResult.user, role, error: null };
}

/**
 * Helper to check if auth result is successful
 */
export function isAuthSuccess(result: AuthResult): result is AuthSuccess {
  return result.error === null;
}

/**
 * Helper to check if role auth result is successful
 */
export function isRoleAuthSuccess(result: RoleAuthResult): result is RoleAuthSuccess {
  return result.error === null;
}
