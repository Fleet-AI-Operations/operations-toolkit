/**
 * Unit tests for /api/audit-logs route
 * Tests date validation, pagination, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      })),
    },
  })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(() => ({ role: 'ADMIN' })),
    },
    auditLog: {
      findMany: vi.fn(() => []),
      count: vi.fn(() => 0),
    },
  },
}));

describe('GET /api/audit-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Date Validation', () => {
    it('should return 400 for invalid startDate format', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?startDate=invalid-date');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid startDate format');
      expect(data.error).toContain('ISO 8601');
    });

    it('should return 400 for invalid endDate format', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?endDate=not-a-date');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid endDate format');
      expect(data.error).toContain('ISO 8601');
    });

    it('should return 400 when endDate is before startDate', async () => {
      const request = new NextRequest(
        'http://localhost/api/audit-logs?startDate=2024-12-31T00:00:00Z&endDate=2024-01-01T00:00:00Z'
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('endDate must be after startDate');
    });

    it('should accept valid date range', async () => {
      const request = new NextRequest(
        'http://localhost/api/audit-logs?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T00:00:00Z'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should accept startDate without endDate', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?startDate=2024-01-01T00:00:00Z');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should accept endDate without startDate', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?endDate=2024-12-31T00:00:00Z');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should handle empty string dates gracefully', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?startDate=&endDate=');
      const response = await GET(request);

      // Empty strings should be ignored, not cause validation errors
      expect(response.status).toBe(200);
    });
  });

  describe('Pagination Validation', () => {
    it('should clamp take to maximum of 100', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?take=500');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.take).toBe(100);
    });

    it('should clamp skip to minimum of 0 for negative values', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?skip=-10');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.skip).toBe(0);
    });

    it('should clamp take to minimum of 1', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?take=0');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.take).toBe(1);
    });

    it('should handle non-numeric skip gracefully', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?skip=abc');
      const response = await GET(request);

      // Should not throw error, returns 200
      expect(response.status).toBe(200);
    });

    it('should handle non-numeric take gracefully', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?take=xyz');
      const response = await GET(request);

      // Should not throw error, returns 200
      expect(response.status).toBe(200);
    });
  });

  describe('Filter Parameters', () => {
    it('should accept valid action filter', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?action=USER_CREATED');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should accept valid entityType filter', async () => {
      const request = new NextRequest('http://localhost/api/audit-logs?entityType=USER');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should accept multiple filters', async () => {
      const request = new NextRequest(
        'http://localhost/api/audit-logs?action=USER_CREATED&entityType=USER&userId=test-123'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Authorization', () => {
    it('should return 401 for unauthenticated users', async () => {
      // Mock unauthenticated user
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValue({
        auth: {
          getUser: vi.fn(() => ({ data: { user: null } })),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/audit-logs');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 for non-admin users', async () => {
      // Reset and mock non-admin user
      vi.clearAllMocks();

      const { createClient } = await import('@/lib/supabase/server');
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(createClient).mockReturnValue({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: { id: 'user-123', email: 'user@example.com' } },
          })),
        },
      } as any);

      vi.mocked(prisma.profile.findUnique).mockResolvedValue({
        id: 'user-123',
        role: 'USER',
        email: 'user@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        mustResetPassword: false,
      } as any);

      const request = new NextRequest('http://localhost/api/audit-logs');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });
});
