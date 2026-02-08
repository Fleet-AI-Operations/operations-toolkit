import { NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { getUserRole } from '@repo/auth/utils';
/**
 * Require authentication for API routes
 * Returns user or error response
 */
export async function requireAuth(req) {
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
export async function requireRole(req, roles) {
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
            error: NextResponse.json({ error: `Forbidden - ${roles.join(' or ')} role required` }, { status: 403 })
        };
    }
    return {
        user: authResult.user,
        role,
        error: null
    };
}
/**
 * Helper to check if auth result is successful
 */
export function isAuthSuccess(result) {
    return result.error === null;
}
/**
 * Helper to check if role auth result is successful
 */
export function isRoleAuthSuccess(result) {
    return result.error === null;
}
