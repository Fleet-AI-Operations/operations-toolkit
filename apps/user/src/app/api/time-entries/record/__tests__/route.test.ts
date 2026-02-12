import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@repo/database';

// Mock Prisma
vi.mock('@repo/database', () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
    },
    timeEntry: {
      create: vi.fn(),
    },
  },
}));

describe('/api/time-entries/record', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProfile = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'USER',
    mustResetPassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTimeEntry = {
    id: 'entry-123',
    userId: 'user-123',
    date: new Date(2026, 1, 10),
    hours: 2,
    minutes: 30,
    category: 'Writing New Tasks',
    count: 5,
    notes: 'Test notes',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('POST', () => {
    it('should create a time entry with valid data', async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile);
      vi.mocked(prisma.timeEntry.create).mockResolvedValue(mockTimeEntry);

      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          category: 'Writing New Tasks',
          hours: 2,
          minutes: 30,
          count: 5,
          notes: 'Test notes',
          date: '2026-02-10',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.entry).toMatchObject({
        id: 'entry-123',
        hours: 2,
        minutes: 30,
        category: 'Writing New Tasks',
      });
      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(prisma.timeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
        }),
      });
    });

    it('should default to today if date not provided', async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile);
      vi.mocked(prisma.timeEntry.create).mockResolvedValue(mockTimeEntry);

      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          category: 'Writing New Tasks',
          hours: 1,
          minutes: 0,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it('should reject missing required fields', async () => {
      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          category: 'Writing New Tasks',
          // Missing hours and minutes
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject invalid email format', async () => {
      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          category: 'Writing New Tasks',
          hours: 1,
          minutes: 0,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email format');
    });

    it('should create time entry for non-existent user', async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);
      const entryWithoutUser = {
        ...mockTimeEntry,
        userId: null,
        email: 'nonexistent@example.com',
      };
      vi.mocked(prisma.timeEntry.create).mockResolvedValue(entryWithoutUser);

      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          category: 'Writing New Tasks',
          hours: 1,
          minutes: 0,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(prisma.timeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          email: 'nonexistent@example.com',
        }),
      });
    });

    it('should reject invalid hours', async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile);

      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          category: 'Writing New Tasks',
          hours: 25, // Invalid
          minutes: 0,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Hours must be an integer between 0 and 23');
    });

    it('should reject invalid minutes', async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile);

      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          category: 'Writing New Tasks',
          hours: 1,
          minutes: 60, // Invalid
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Minutes must be an integer between 0 and 59');
    });

    it('should reject 0h 0m time', async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile);

      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          category: 'Writing New Tasks',
          hours: 0,
          minutes: 0,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Time cannot be 0h 0m');
    });

    it('should reject invalid category', async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile);

      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          category: 'Invalid Category',
          hours: 1,
          minutes: 0,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid category');
    });

    it('should reject invalid count', async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile);

      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          category: 'Writing New Tasks',
          hours: 1,
          minutes: 0,
          count: -5, // Invalid
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Count must be a positive integer');
    });

    it('should reject notes that are too long', async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile);

      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          category: 'Writing New Tasks',
          hours: 1,
          minutes: 0,
          notes: 'x'.repeat(2001), // Too long
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Notes must be 2000 characters or less');
    });

    it('should handle lowercase email lookup', async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile);
      vi.mocked(prisma.timeEntry.create).mockResolvedValue(mockTimeEntry);

      const request = new NextRequest('http://localhost:3001/api/time-entries/record', {
        method: 'POST',
        body: JSON.stringify({
          email: 'TEST@EXAMPLE.COM', // Uppercase
          category: 'Writing New Tasks',
          hours: 1,
          minutes: 0,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }, // Should be lowercase
      });
    });
  });
});
