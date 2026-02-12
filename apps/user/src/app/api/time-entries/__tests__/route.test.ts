import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock dependencies
vi.mock('@repo/auth/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    timeEntry: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as any;

describe('GET /api/time-entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return time entries for authenticated user', async () => {
    const mockUser = { id: 'user-123' };
    const mockEntries = [
      {
        id: 'entry-1',
        date: '2026-02-10',
        hours: 2,
        minutes: 30,
        category: 'Writing New Tasks',
        count: 5,
        notes: 'Test notes',
      },
    ];

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.findMany.mockResolvedValue(mockEntries);

    const request = new NextRequest('http://localhost:3001/api/time-entries');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.entries).toEqual(mockEntries);
    expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith({
      where: { userId: mockUser.id },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  });

  it('should filter by date range when provided', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3001/api/time-entries?startDate=2026-02-01&endDate=2026-02-15'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith({
      where: {
        userId: mockUser.id,
        date: {
          gte: expect.any(Date),
          lte: expect.any(Date),
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  });
});

describe('POST /api/time-entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-02-10',
        hours: 2,
        minutes: 30,
        category: 'Writing New Tasks',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if required fields are missing', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-02-10',
        hours: 2,
        // missing minutes and category
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('should return 400 if hours is invalid', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-02-10',
        hours: 25, // invalid
        minutes: 30,
        category: 'Writing New Tasks',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Hours must be');
  });

  it('should return 400 if minutes is invalid', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-02-10',
        hours: 2,
        minutes: 60, // invalid
        category: 'Writing New Tasks',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Minutes must be');
  });

  it('should return 400 if time is 0h 0m', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-02-10',
        hours: 0,
        minutes: 0,
        category: 'Writing New Tasks',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Time cannot be 0h 0m');
  });

  it('should return 400 if category is invalid', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-02-10',
        hours: 2,
        minutes: 30,
        category: 'Invalid Category',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid category');
  });

  it('should return 400 if count is negative', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-02-10',
        hours: 2,
        minutes: 30,
        category: 'Writing New Tasks',
        count: -5,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Count must be');
  });

  it('should return 400 if notes exceed 2000 characters', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    const longNotes = 'a'.repeat(2001);

    const request = new NextRequest('http://localhost:3001/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-02-10',
        hours: 2,
        minutes: 30,
        category: 'Writing New Tasks',
        notes: longNotes,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Notes must be 2000 characters or less');
  });

  it('should create time entry with valid data', async () => {
    const mockUser = { id: 'user-123' };
    const mockEntry = {
      id: 'entry-1',
      userId: mockUser.id,
      date: new Date(2026, 1, 10),
      hours: 2,
      minutes: 30,
      category: 'Writing New Tasks',
      count: 5,
      notes: 'Test notes',
    };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.create.mockResolvedValue(mockEntry);

    const request = new NextRequest('http://localhost:3001/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-02-10',
        hours: 2,
        minutes: 30,
        category: 'Writing New Tasks',
        count: 5,
        notes: 'Test notes',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.entry).toMatchObject({
      id: 'entry-1',
      userId: mockUser.id,
      hours: 2,
      minutes: 30,
      category: 'Writing New Tasks',
      count: 5,
      notes: 'Test notes',
    });
    expect(mockPrisma.timeEntry.create).toHaveBeenCalled();
  });

  it('should handle non-numeric values gracefully', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-02-10',
        hours: 'abc', // non-numeric
        minutes: 30,
        category: 'Writing New Tasks',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Hours must be');
  });
});
