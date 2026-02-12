/**
 * Authentication and authorization helper functions for API routes
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';
import { hasPermission } from '@/lib/permissions';

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
 * Check if the current user has permission to access a resource
 * Returns user object if authorized, or an error NextResponse if not
 *
 * @param requiredRole - The minimum role required to access the resource
 * @returns Object with either user data or error response
 *
 * @example
 * const result = await requireRole('ADMIN');
 * if ('error' in result) return result.error;
 * const user = result.user;
 */
export async function requireRole(
  requiredRole: UserRole
): Promise<{ user: AuthenticatedUser } | { error: NextResponse }> {
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
 * Check if the current user has one of the specified roles (no inheritance)
 *
 * @param allowedRoles - Array of roles that are allowed
 * @returns Object with either user data or error response
 */
export async function requireAnyRole(
  allowedRoles: UserRole[]
): Promise<{ user: AuthenticatedUser } | { error: NextResponse }> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(user.role)) {
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
 * @returns Object with either user data or error response
 */
export async function requireAuth(): Promise<
  { user: AuthenticatedUser } | { error: NextResponse }
> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user };
}
