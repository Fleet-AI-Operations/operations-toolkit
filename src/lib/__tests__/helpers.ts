/**
 * Test Helpers
 * Common utilities for unit and integration tests
 */

import { vi } from 'vitest';

/**
 * Mock Prisma Client for unit tests
 * Usage:
 * ```typescript
 * const { mockPrisma } = vi.hoisted(() => createMockPrisma());
 * vi.mock('../prisma', () => ({ prisma: mockPrisma }));
 * ```
 */
export function createMockPrisma() {
  const mockPrisma = {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    profile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    dataRecord: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    ingestJob: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    analyticsJob: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    systemSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockPrisma)),
    $disconnect: vi.fn(),
  };

  return { mockPrisma };
}

/**
 * Mock Supabase Client for unit tests
 * Usage:
 * ```typescript
 * vi.mock('@/lib/supabase/client', () => ({
 *   createClient: () => createMockSupabaseClient()
 * }));
 * ```
 */
export function createMockSupabaseClient() {
  return {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  };
}

/**
 * Mock fetch for AI API calls
 * Usage:
 * ```typescript
 * global.fetch = vi.fn();
 * mockAIResponse({ embedding: [0.1, 0.2, 0.3] });
 * ```
 */
export function mockAIResponse(data: any) {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: [data] }),
  });
}

/**
 * Mock failed AI API call
 */
export function mockAIError(error: string = 'API Error') {
  (global.fetch as any).mockResolvedValue({
    ok: false,
    statusText: error,
    json: () => Promise.resolve({ error }),
  });
}

/**
 * Create test user data
 */
export function createTestUser(overrides?: Partial<any>) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'USER',
    mustResetPassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create test project data
 */
export function createTestProject(overrides?: Partial<any>) {
  return {
    id: 'test-project-id',
    name: 'Test Project',
    ownerId: 'test-user-id',
    guidelines: null,
    guidelinesFileName: null,
    lastTaskAnalysis: null,
    lastFeedbackAnalysis: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create test data record
 */
export function createTestDataRecord(overrides?: Partial<any>) {
  return {
    id: 'test-record-id',
    projectId: 'test-project-id',
    type: 'TASK',
    category: 'TOP_10',
    source: 'test',
    content: 'Test content',
    metadata: {},
    embedding: null as any, // Null embedding (uses type assertion for Prisma compatibility)
    hasBeenReviewed: false,
    isCategoryCorrect: null,
    reviewedBy: null,
    alignmentAnalysis: null,
    ingestJobId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Wait for async operations to complete
 * Useful in tests that need to wait for state updates
 */
export function waitFor(ms: number = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reset all mocks between tests
 * Usage in beforeEach:
 * ```typescript
 * beforeEach(() => {
 *   resetAllMocks();
 * });
 * ```
 */
export function resetAllMocks() {
  vi.resetAllMocks();
  vi.clearAllMocks();
}
