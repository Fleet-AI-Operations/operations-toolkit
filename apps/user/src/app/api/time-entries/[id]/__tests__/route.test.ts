import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '../route';

// Mock dependencies
vi.mock('@repo/auth/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    timeEntry: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as any;

describe('PATCH /api/time-entries/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries/entry-1', {
      method: 'PATCH',
      body: JSON.stringify({ hours: 3 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'entry-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 if entry does not exist', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3001/api/time-entries/entry-1', {
      method: 'PATCH',
      body: JSON.stringify({ hours: 3 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'entry-1' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Time entry not found');
  });

  it('should return 403 if entry belongs to different user', async () => {
    const mockUser = { id: 'user-123' };
    const existingEntry = {
      id: 'entry-1',
      userId: 'different-user',
      hours: 2,
      minutes: 30,
    };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.findUnique.mockResolvedValue(existingEntry);

    const request = new NextRequest('http://localhost:3001/api/time-entries/entry-1', {
      method: 'PATCH',
      body: JSON.stringify({ hours: 3 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'entry-1' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should return 400 if updating to 0h 0m', async () => {
    const mockUser = { id: 'user-123' };
    const existingEntry = {
      id: 'entry-1',
      userId: mockUser.id,
      hours: 2,
      minutes: 30,
      category: 'Writing New Tasks',
    };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.findUnique.mockResolvedValue(existingEntry);

    const request = new NextRequest('http://localhost:3001/api/time-entries/entry-1', {
      method: 'PATCH',
      body: JSON.stringify({ hours: 0, minutes: 0 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'entry-1' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Time cannot be 0h 0m');
  });

  it('should return 400 if category is invalid', async () => {
    const mockUser = { id: 'user-123' };
    const existingEntry = {
      id: 'entry-1',
      userId: mockUser.id,
      hours: 2,
      minutes: 30,
      category: 'Writing New Tasks',
    };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.findUnique.mockResolvedValue(existingEntry);

    const request = new NextRequest('http://localhost:3001/api/time-entries/entry-1', {
      method: 'PATCH',
      body: JSON.stringify({ category: 'Invalid Category' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'entry-1' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid category');
  });

  it('should successfully update time entry', async () => {
    const mockUser = { id: 'user-123' };
    const existingEntry = {
      id: 'entry-1',
      userId: mockUser.id,
      hours: 2,
      minutes: 30,
      category: 'Writing New Tasks',
    };

    const updatedEntry = {
      ...existingEntry,
      hours: 3,
      notes: 'Updated notes',
    };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.findUnique.mockResolvedValue(existingEntry);
    mockPrisma.timeEntry.update.mockResolvedValue(updatedEntry);

    const request = new NextRequest('http://localhost:3001/api/time-entries/entry-1', {
      method: 'PATCH',
      body: JSON.stringify({ hours: 3, notes: 'Updated notes' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'entry-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.entry).toEqual(updatedEntry);
    expect(mockPrisma.timeEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: expect.objectContaining({
        hours: 3,
        notes: 'Updated notes',
      }),
    });
  });
});

describe('DELETE /api/time-entries/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const request = new NextRequest('http://localhost:3001/api/time-entries/entry-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'entry-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 if entry does not exist', async () => {
    const mockUser = { id: 'user-123' };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3001/api/time-entries/entry-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'entry-1' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Time entry not found');
  });

  it('should return 403 if entry belongs to different user', async () => {
    const mockUser = { id: 'user-123' };
    const existingEntry = {
      id: 'entry-1',
      userId: 'different-user',
    };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.findUnique.mockResolvedValue(existingEntry);

    const request = new NextRequest('http://localhost:3001/api/time-entries/entry-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'entry-1' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should successfully delete time entry', async () => {
    const mockUser = { id: 'user-123' };
    const existingEntry = {
      id: 'entry-1',
      userId: mockUser.id,
    };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    });

    mockPrisma.timeEntry.findUnique.mockResolvedValue(existingEntry);
    mockPrisma.timeEntry.delete.mockResolvedValue(existingEntry);

    const request = new NextRequest('http://localhost:3001/api/time-entries/entry-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'entry-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.timeEntry.delete).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
    });
  });
});
