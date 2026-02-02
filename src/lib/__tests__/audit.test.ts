/**
 * Unit tests for audit logging functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const { mockPrisma, mockSupabase, mockCreateId } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
  mockSupabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
  mockCreateId: vi.fn(() => 'test-cuid-12345'),
}));

// Mock modules
vi.mock('../prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('../supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: mockCreateId,
}));

// Now import the functions under test
import { logAudit, getCurrentUserForAudit } from '../audit';

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create audit log with all required fields', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({
      id: 'test-cuid-12345',
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: 'user-123',
      projectId: null,
      userId: 'admin-123',
      userEmail: 'admin@example.com',
      metadata: { role: 'USER' },
      createdAt: new Date(),
    });

    const result = await logAudit({
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: 'user-123',
      userId: 'admin-123',
      userEmail: 'admin@example.com',
      metadata: { role: 'USER' },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        id: 'test-cuid-12345',
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: 'user-123',
        projectId: undefined,
        userId: 'admin-123',
        userEmail: 'admin@example.com',
        metadata: { role: 'USER' },
      },
    });
  });

  it('should create audit log with optional projectId', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAudit({
      action: 'PROJECT_CREATED',
      entityType: 'PROJECT',
      entityId: 'proj-123',
      projectId: 'proj-123',
      userId: 'admin-123',
      userEmail: 'admin@example.com',
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'proj-123',
      }),
    });
  });

  it('should handle null metadata', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAudit({
      action: 'USER_CREATED',
      entityType: 'USER',
      userId: 'admin-123',
      userEmail: 'admin@example.com',
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: undefined,
      }),
    });
  });

  it('should return failure on database error (graceful degradation)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockPrisma.auditLog.create.mockRejectedValue(new Error('Database error'));

    // Should not throw but return failure
    const result = await logAudit({
      action: 'USER_CREATED',
      entityType: 'USER',
      userId: 'admin-123',
      userEmail: 'admin@example.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database error');

    // Should log the error with structured context
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'CRITICAL: Failed to log audit event. Audit trail may be incomplete.',
      expect.objectContaining({
        errorId: 'AUDIT_LOG_FAILED',
        action: 'USER_CREATED',
        entityType: 'USER',
        userId: 'admin-123',
        error: 'Database error',
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it('should generate unique CUID for each log entry', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAudit({
      action: 'USER_CREATED',
      entityType: 'USER',
      userId: 'admin-123',
      userEmail: 'admin@example.com',
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'test-cuid-12345',
      }),
    });
  });
});

describe('getCurrentUserForAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user id and email when authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'user@example.com',
        },
      },
      error: null,
    });

    const result = await getCurrentUserForAudit();

    expect(result).toEqual({
      id: 'user-123',
      email: 'user@example.com',
    });
  });

  it('should return null when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await getCurrentUserForAudit();

    expect(result).toBeNull();
  });

  it('should return null when user has no email', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: null,
        },
      },
      error: null,
    });

    const result = await getCurrentUserForAudit();

    expect(result).toBeNull();
  });

  it('should return null on Supabase error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSupabase.auth.getUser.mockRejectedValue(new Error('Auth error'));

    const result = await getCurrentUserForAudit();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to get current user for audit:',
      expect.objectContaining({
        errorId: 'AUDIT_AUTH_CHECK_FAILED',
        error: 'Auth error',
      })
    );

    consoleErrorSpy.mockRestore();
  });
});

describe('Audit Action Types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should support all user management actions', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    const actions = ['USER_CREATED', 'USER_ROLE_CHANGED', 'USER_PASSWORD_RESET'];

    for (const action of actions) {
      await logAudit({
        action: action as any,
        entityType: 'USER',
        userId: 'admin-123',
        userEmail: 'admin@example.com',
      });
    }

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(3);
  });

  it('should support all project actions', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    const actions = ['PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_DELETED'];

    for (const action of actions) {
      await logAudit({
        action: action as any,
        entityType: 'PROJECT',
        userId: 'admin-123',
        userEmail: 'admin@example.com',
      });
    }

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(3);
  });

  it('should support all data operation actions', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    const actions = ['DATA_CLEARED', 'ANALYTICS_CLEARED', 'BULK_ALIGNMENT_STARTED'];

    for (const action of actions) {
      await logAudit({
        action: action as any,
        entityType: 'DATA_RECORD',
        userId: 'admin-123',
        userEmail: 'admin@example.com',
      });
    }

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(3);
  });
});
