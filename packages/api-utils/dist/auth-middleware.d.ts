import { NextRequest, NextResponse } from 'next/server';
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
export declare function requireAuth(req: NextRequest): Promise<AuthResult>;
/**
 * Require specific role(s) for API routes
 * Returns user, role, or error response
 */
export declare function requireRole(req: NextRequest, roles: UserRole[]): Promise<RoleAuthResult>;
/**
 * Require a minimum role (hierarchical). Any role >= minRole is accepted.
 * ADMIN > MANAGER/FLEET > CORE > QA > USER > PENDING
 *
 * Note: MANAGER and FLEET share the same weight (4), so requireMinRole(req, 'FLEET')
 * also admits MANAGER users and vice versa. Use requireRole() with an explicit list
 * if you need to distinguish between them.
 */
export declare function requireMinRole(req: NextRequest, minRole: UserRole): Promise<RoleAuthResult>;
/**
 * Helper to check if auth result is successful
 */
export declare function isAuthSuccess(result: AuthResult): result is AuthSuccess;
/**
 * Helper to check if role auth result is successful
 */
export declare function isRoleAuthSuccess(result: RoleAuthResult): result is RoleAuthSuccess;
//# sourceMappingURL=auth-middleware.d.ts.map