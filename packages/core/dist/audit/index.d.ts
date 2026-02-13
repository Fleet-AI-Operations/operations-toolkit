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
export type AuditAction = 'USER_CREATED' | 'USER_UPDATED' | 'USER_ROLE_CHANGED' | 'USER_PASSWORD_RESET' | 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'PROJECT_DELETED' | 'DATA_CLEARED' | 'ANALYTICS_CLEARED' | 'BULK_ALIGNMENT_STARTED' | 'LIKERT_SCORES_CLEARED' | 'PROJECT_RECORDS_CLEARED' | 'SYSTEM_SETTINGS_UPDATED' | 'BONUS_WINDOW_CREATED' | 'BONUS_WINDOW_UPDATED' | 'BONUS_WINDOW_DELETED' | 'LLM_MODEL_CREATED' | 'LLM_MODEL_UPDATED' | 'LLM_MODEL_DELETED' | 'BULK_EVALUATION_STARTED' | 'BULK_EVALUATION_CANCELLED' | 'RATER_GROUP_CREATED' | 'RATER_GROUP_UPDATED' | 'RATER_GROUP_DELETED' | 'RATER_GROUP_MEMBERS_ADDED' | 'RATER_GROUP_MEMBER_REMOVED' | 'ASSIGNMENT_BATCH_CREATED' | 'ASSIGNMENT_BATCH_UPDATED' | 'ASSIGNMENT_BATCH_DELETED' | 'ASSIGNMENT_BATCH_DISTRIBUTED';
export type EntityType = 'USER' | 'PROJECT' | 'DATA_RECORD' | 'LIKERT_SCORE' | 'SYSTEM_SETTING' | 'BONUS_WINDOW' | 'LLM_MODEL_CONFIG' | 'LLM_EVALUATION_JOB' | 'RATER_GROUP' | 'ASSIGNMENT_BATCH';
export interface LogAuditParams {
    action: AuditAction;
    entityType: EntityType;
    entityId?: string;
    projectId?: string;
    userId: string;
    userEmail: string;
    metadata?: Record<string, unknown>;
}
export interface LogAuditResult {
    success: boolean;
    error?: string;
}
/**
 * Log an audit event to the database.
 * Returns success/failure status to allow callers to handle audit failures appropriately.
 * Does not throw errors - audit failures should not break primary operations.
 */
export declare function logAudit(params: LogAuditParams): Promise<LogAuditResult>;
/**
 * List of critical audit actions that should generate warnings when audit logging fails.
 * These operations have compliance or security implications.
 */
export declare const CRITICAL_AUDIT_ACTIONS: AuditAction[];
/**
 * Helper function to check audit result and log warnings for critical operations.
 * Use this after calling logAudit() for operations that have compliance requirements.
 */
export declare function checkAuditResult(result: LogAuditResult, action: AuditAction, context: {
    entityId?: string;
    userId: string;
}): void;
/**
 * Helper to get current user info for audit logging.
 * Returns null if user is not authenticated.
 */
export declare function getCurrentUserForAudit(): Promise<{
    id: string;
    email: string;
} | null>;
//# sourceMappingURL=index.d.ts.map