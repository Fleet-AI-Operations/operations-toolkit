import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn(() => ({
                data: { user: { id: 'test-user-id' } },
                error: null
            }))
        }
    }))
}));

vi.mock('@repo/database', () => ({
    prisma: {
        profile: {
            findUnique: vi.fn(() => ({ role: 'FLEET' }))
        },
        $queryRaw: vi.fn()
    }
}));

const mockTaskRow = (overrides = {}) => ({
    id: 'task-1',
    content: 'Test task content',
    environment: 'Production',
    metadata: {},
    createdByName: 'Test User',
    createdByEmail: 'test@example.com',
    createdAt: new Date('2026-01-15'),
    ...overrides,
});

describe('GET /api/full-similarity-check', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: {
                getUser: vi.fn(() => ({
                    data: { user: null },
                    error: new Error('Unauthorized')
                }))
            }
        } as any);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check');
        const response = await GET(request);

        expect(response.status).toBe(401);
        expect((await response.json()).error).toBe('Unauthorized');
    });

    it('returns 403 for users without FLEET or ADMIN role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'USER' } as any);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check?environment=prod');
        const response = await GET(request);

        expect(response.status).toBe(403);
        expect((await response.json()).error).toBe('Forbidden');
    });

    it('returns paginated tasks with embeddings (latestOnly=false)', async () => {
        const { prisma } = await import('@repo/database');
        const tasks = [mockTaskRow({ id: 'task-1' }), mockTaskRow({ id: 'task-2' })];
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(2) }])  // count query
            .mockResolvedValueOnce(tasks);                   // data query

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check?environment=Production');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tasks).toHaveLength(2);
        expect(data.pagination).toMatchObject({ page: 1, totalCount: 2, totalPages: 1 });
        expect(data.tasks[0]).toMatchObject({ id: 'task-1', createdBy: 'Test User' });
    });

    it('returns paginated tasks (latestOnly=true)', async () => {
        const { prisma } = await import('@repo/database');
        const tasks = [mockTaskRow({ id: 'task-latest' })];
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(1) }])
            .mockResolvedValueOnce(tasks);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check?environment=Production&latestOnly=true');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tasks).toHaveLength(1);
        expect(data.tasks[0].id).toBe('task-latest');
    });

    it('returns empty tasks array when no records have embeddings', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(0) }])
            .mockResolvedValueOnce([]);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check?environment=empty-env');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tasks).toHaveLength(0);
        expect(data.pagination.totalCount).toBe(0);
    });

    it('falls back to "N/A" for null environment and "Unknown" for null creator', async () => {
        const { prisma } = await import('@repo/database');
        const task = mockTaskRow({ environment: null, createdByName: null, createdByEmail: null });
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(1) }])
            .mockResolvedValueOnce([task]);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tasks[0].environment).toBe('N/A');
        expect(data.tasks[0].createdBy).toBe('Unknown');
    });

    it('falls back to email when createdByName is null', async () => {
        const { prisma } = await import('@repo/database');
        const task = mockTaskRow({ createdByName: null, createdByEmail: 'user@example.com' });
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(1) }])
            .mockResolvedValueOnce([task]);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check');
        const response = await GET(request);
        const data = await response.json();

        expect(data.tasks[0].createdBy).toBe('user@example.com');
    });

    it('handles $queryRaw failure gracefully', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('DB connection lost'));

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check');
        const response = await GET(request);

        expect(response.status).toBe(500);
    });
});
