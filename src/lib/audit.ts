/**
 * Audit logging utilities for tracking user actions and administrative operations.
 *
 * Usage:
 * ```ts
 * import { logAudit } from '@/lib/audit';
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

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { createId } from '@paralleldrive/cuid2';
import { ERROR_IDS } from '@/constants/errorIds';

export type AuditAction =
  // User Management
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_PASSWORD_RESET'
  // Project Operations
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  // Data Operations
  | 'DATA_CLEARED'
  | 'ANALYTICS_CLEARED'
  | 'BULK_ALIGNMENT_STARTED'
  | 'LIKERT_SCORES_CLEARED'
  | 'PROJECT_RECORDS_CLEARED'
  // System Settings
  | 'SYSTEM_SETTINGS_UPDATED'
  // Bonus Windows
  | 'BONUS_WINDOW_CREATED'
  | 'BONUS_WINDOW_UPDATED'
  | 'BONUS_WINDOW_DELETED'
  // LLM Model Config
  | 'LLM_MODEL_CREATED'
  | 'LLM_MODEL_UPDATED'
  | 'LLM_MODEL_DELETED'
  // LLM Evaluation
  | 'BULK_EVALUATION_STARTED'
  | 'BULK_EVALUATION_CANCELLED'
  // Rater Groups
  | 'RATER_GROUP_CREATED'
  | 'RATER_GROUP_UPDATED'
  | 'RATER_GROUP_DELETED'
  | 'RATER_GROUP_MEMBERS_ADDED'
  | 'RATER_GROUP_MEMBER_REMOVED'
  // Assignment Batches
  | 'ASSIGNMENT_BATCH_CREATED'
  | 'ASSIGNMENT_BATCH_UPDATED'
  | 'ASSIGNMENT_BATCH_DELETED'
  | 'ASSIGNMENT_BATCH_DISTRIBUTED';

export type EntityType =
  | 'USER'
  | 'PROJECT'
  | 'DATA_RECORD'
  | 'LIKERT_SCORE'
  | 'SYSTEM_SETTING'
  | 'BONUS_WINDOW'
  | 'LLM_MODEL_CONFIG'
  | 'LLM_EVALUATION_JOB'
  | 'RATER_GROUP'
  | 'ASSIGNMENT_BATCH';

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
export async function logAudit(params: LogAuditParams): Promise<LogAuditResult> {
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
        metadata: params.metadata as any,
      },
    });
    return { success: true };
  } catch (error) {
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
export const CRITICAL_AUDIT_ACTIONS: AuditAction[] = [
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
export function checkAuditResult(
  result: LogAuditResult,
  action: AuditAction,
  context: { entityId?: string; userId: string }
): void {
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
export async function getCurrentUserForAudit(): Promise<{
  id: string;
  email: string;
} | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
    };
  } catch (error) {
    console.error('Failed to get current user for audit:', {
      errorId: ERROR_IDS.AUDIT_AUTH_CHECK_FAILED,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
