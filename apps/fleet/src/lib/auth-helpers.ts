/**
 * Authentication and authorization helper functions for API routes
 * Fleet app version - adapted for monorepo structure
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import type { UserRole } from '@repo/database';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Get the authenticated user with profile information
 *
 * @returns User object with id, email, and role, or null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { email: true, role: true },
  });

  if (!profile) {
    return null;
  }

  return {
    id: user.id,
    email: profile.email,
    role: profile.role,
  };
}

/**
 * Role hierarchy for permission checking
 * Higher roles inherit permissions from lower roles
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  USER: 1,
  QA: 2,
  CORE: 3,
  FLEET: 4,
  ADMIN: 5,
};

/**
 * Check if a user has permission for a required role (hierarchical)
 */
function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if the current user has permission to access a resource
 * Returns user object if authorized, or an error NextResponse if not
 *
 * @param request - The Next.js request object
 * @param requiredRole - The minimum role required to access the resource
 * @returns Object with either user data or error response
 *
 * @example
 * const result = await requireRole(request, 'FLEET');
 * if (result.error) return result.error;
 * const user = result.user;
 */
export async function requireRole(
  request: NextRequest,
  requiredRole: UserRole
): Promise<{ user?: AuthenticatedUser; error?: NextResponse }> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (!hasPermission(user.role, requiredRole)) {
    return {
      error: NextResponse.json(
        { error: `Forbidden - ${requiredRole} role or higher required` },
        { status: 403 }
      ),
    };
  }

  return { user };
}

/**
 * Check if the current user has one of the specified roles
 * Uses hierarchical permissions - higher roles automatically qualify
 *
 * @param request - The Next.js request object
 * @param allowedRoles - Array of roles that are allowed
 * @returns Object with either user data or error response
 *
 * @example
 * const result = await requireAnyRole(request, ['FLEET', 'ADMIN']);
 * if (result.error) return result.error;
 * const user = result.user;
 */
export async function requireAnyRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<{ user?: AuthenticatedUser; error?: NextResponse }> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // Check if user has any of the allowed roles (or higher)
  const hasAccess = allowedRoles.some(allowedRole =>
    hasPermission(user.role, allowedRole)
  );

  if (!hasAccess) {
    return {
      error: NextResponse.json(
        {
          error: `Forbidden - One of these roles required: ${allowedRoles.join(', ')}`,
        },
        { status: 403 }
      ),
    };
  }

  return { user };
}

/**
 * Require authentication but no specific role (any authenticated user)
 *
 * @param request - The Next.js request object
 * @returns Object with either user data or error response
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user?: AuthenticatedUser; error?: NextResponse }> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user };
}
