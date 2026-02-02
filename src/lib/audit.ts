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

export type AuditAction =
  // User Management
  | 'USER_CREATED'
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
  // System Settings
  | 'SYSTEM_SETTINGS_UPDATED'
  // Bonus Windows
  | 'BONUS_WINDOW_CREATED'
  | 'BONUS_WINDOW_UPDATED'
  | 'BONUS_WINDOW_DELETED';

export type EntityType =
  | 'USER'
  | 'PROJECT'
  | 'DATA_RECORD'
  | 'SYSTEM_SETTING'
  | 'BONUS_WINDOW';

export interface LogAuditParams {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  projectId?: string;
  userId: string;
  userEmail: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event to the database.
 * Uses try/catch to prevent audit failures from breaking operations.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
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
        metadata: params.metadata || null,
      },
    });
  } catch (error) {
    // Log error but don't throw - audit failures shouldn't break operations
    console.error('Failed to log audit event:', error);
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
    console.error('Failed to get current user for audit:', error);
    return null;
  }
}
