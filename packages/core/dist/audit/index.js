/**
 * Audit logging utilities for tracking user actions and administrative operations.
 *
 * Usage:
 * ```ts
 * import { logAudit } from '@repo/core/audit';
 *
 * await logAudit({
 *   action: 'USER_CREATED',
 *   entityType: 'USER',
 *   entityId: newUser.id,
 *   userId: currentUser.id,
 *   userEmail: currentUser.email,
 *   metadata: { role: 'ADMIN' }
 * });
 * ```
 */
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { createId } from '@paralleldrive/cuid2';
import { ERROR_IDS } from '../utils/errorIds';
/**
 * Log an audit event to the database.
 * Returns success/failure status to allow callers to handle audit failures appropriately.
 * Does not throw errors - audit failures should not break primary operations.
 */
export async function logAudit(params) {
    try {
        await prisma.auditLog.create({
            data: {
                id: createId(),
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                projectId: params.projectId,
                userId: params.userId,
                userEmail: params.userEmail,
                metadata: params.metadata,
            },
        });
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Log error but don't throw - audit failures shouldn't break operations
        // TODO: Consider integrating with error tracking service (e.g., Sentry) in production
        console.error('CRITICAL: Failed to log audit event. Audit trail may be incomplete.', {
            errorId: ERROR_IDS.AUDIT_LOG_FAILED,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            userId: params.userId,
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
        });
        return { success: false, error: errorMessage };
    }
}
/**
 * List of critical audit actions that should generate warnings when audit logging fails.
 * These operations have compliance or security implications.
 */
export const CRITICAL_AUDIT_ACTIONS = [
    'USER_CREATED',
    'USER_ROLE_CHANGED',
    'USER_PASSWORD_RESET',
    'PROJECT_DELETED',
    'DATA_CLEARED',
    'ANALYTICS_CLEARED',
    'LIKERT_SCORES_CLEARED',
    'PROJECT_RECORDS_CLEARED',
];
/**
 * Helper function to check audit result and log warnings for critical operations.
 * Use this after calling logAudit() for operations that have compliance requirements.
 */
export function checkAuditResult(result, action, context) {
    if (!result.success && CRITICAL_AUDIT_ACTIONS.includes(action)) {
        console.warn('WARNING: Critical operation completed but audit logging failed', {
            errorId: ERROR_IDS.AUDIT_LOG_FAILED,
            action,
            entityId: context.entityId,
            userId: context.userId,
            auditError: result.error,
            severity: 'HIGH',
            complianceRisk: true,
        });
    }
}
/**
 * Helper to get current user info for audit logging.
 * Returns null if user is not authenticated.
 */
export async function getCurrentUserForAudit() {
    try {
        const supabase = await createClient();
        const { data: { user }, } = await supabase.auth.getUser();
        if (!user?.email) {
            return null;
        }
        return {
            id: user.id,
            email: user.email,
        };
    }
    catch (error) {
        console.error('Failed to get current user for audit:', {
            errorId: ERROR_IDS.AUDIT_AUTH_CHECK_FAILED,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return null;
    }
}
