import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn(() => ({
                data: { user: { id: 'fleet-user-id' } },
                error: null,
            })),
        },
    })),
}));

vi.mock('@repo/database', () => ({
    prisma: {
        profile: {
            findUnique: vi.fn(() => ({ role: 'FLEET' })),
        },
        $queryRaw: vi.fn(),
    },
}));

const makeRequest = (params: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3004/api/workforce-monitoring');
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return new NextRequest(url.toString());
};

const mockAuthenticatedUser = async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue({
        auth: {
            getUser: vi.fn(() => ({
                data: { user: { id: 'fleet-user-id' } },
                error: null,
            })),
        },
    } as any);
};

describe('GET /api/workforce-monitoring', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await mockAuthenticatedUser();
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);
    });

    it('returns 401 when unauthenticated', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: {
                getUser: vi.fn(() => ({ data: { user: null }, error: new Error('no session') })),
            },
        } as any);

        const res = await GET(makeRequest());
        expect(res.status).toBe(401);
        expect((await res.json()).error).toBe('Unauthorized');
    });

    it('returns 403 when role is below FLEET', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'QA' } as any);

        const res = await GET(makeRequest());
        expect(res.status).toBe(403);
        expect((await res.json()).error).toBe('Forbidden');
    });

    it('returns paginated workers for FLEET user', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ total: BigInt(2) }])
            .mockResolvedValueOnce([
                {
                    email: 'alice@example.com',
                    name: 'Alice Smith',
                    taskCount: BigInt(10),
                    feedbackCount: BigInt(3),
                    activeFlags: BigInt(1),
                    lastActivity: new Date('2026-03-01'),
                },
                {
                    email: 'bob@example.com',
                    name: 'Bob Jones',
                    taskCount: BigInt(5),
                    feedbackCount: BigInt(0),
                    activeFlags: BigInt(0),
                    lastActivity: new Date('2026-02-20'),
                },
            ]);

        const res = await GET(makeRequest());
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.workers).toHaveLength(2);
        expect(data.total).toBe(2);
        expect(data.workers[0].email).toBe('alice@example.com');
        expect(data.workers[0].taskCount).toBe(10);
        expect(data.workers[0].activeFlags).toBe(1);
    });

    it('accepts flagged=flagged filter without error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ total: BigInt(1) }])
            .mockResolvedValueOnce([
                {
                    email: 'flagged@example.com',
                    name: 'Flagged Worker',
                    taskCount: BigInt(4),
                    feedbackCount: BigInt(1),
                    activeFlags: BigInt(2),
                    lastActivity: new Date('2026-03-05'),
                },
            ]);

        const res = await GET(makeRequest({ flagged: 'flagged' }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.workers[0].activeFlags).toBe(2);
    });

    it('accepts flagged=unflagged filter without error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ total: BigInt(1) }])
            .mockResolvedValueOnce([
                {
                    email: 'clean@example.com',
                    name: 'Clean Worker',
                    taskCount: BigInt(8),
                    feedbackCount: BigInt(2),
                    activeFlags: BigInt(0),
                    lastActivity: new Date('2026-03-04'),
                },
            ]);

        const res = await GET(makeRequest({ flagged: 'unflagged' }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.workers[0].activeFlags).toBe(0);
    });

    it('accepts sortBy=taskCount with sortDir=asc', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ total: BigInt(0) }])
            .mockResolvedValueOnce([]);

        const res = await GET(makeRequest({ sortBy: 'taskCount', sortDir: 'asc' }));
        expect(res.status).toBe(200);
    });

    it('returns empty workers array when no records exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ total: BigInt(0) }])
            .mockResolvedValueOnce([]);

        const res = await GET(makeRequest());
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.workers).toHaveLength(0);
        expect(data.total).toBe(0);
    });

    it('respects page and limit params', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ total: BigInt(100) }])
            .mockResolvedValueOnce([]);

        const res = await GET(makeRequest({ page: '3', limit: '10' }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.page).toBe(3);
        expect(data.limit).toBe(10);
    });
});
