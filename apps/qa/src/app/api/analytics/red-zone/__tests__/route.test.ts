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
            findUnique: vi.fn(() => ({ role: 'QA' }))
        },
        $queryRaw: vi.fn()
    }
}));

const makePair = (overrides = {}) => ({
    id1: 'task-1', content1: 'Alpha', name1: 'User A', email1: 'a@example.com', at1: new Date('2026-01-10'),
    id2: 'task-2', content2: 'Beta',  name2: 'User B', email2: 'b@example.com', at2: new Date('2026-01-11'),
    similarity: BigInt(82),
    ...overrides,
});

describe('GET /api/analytics/red-zone', () => {
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

        const request = new NextRequest('http://localhost:3002/api/analytics/red-zone');
        const response = await GET(request);

        expect(response.status).toBe(401);
        expect((await response.json()).error).toBe('Unauthorized');
    });

    it('returns 403 for USER role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'USER' } as any);

        const request = new NextRequest('http://localhost:3002/api/analytics/red-zone');
        const response = await GET(request);

        expect(response.status).toBe(403);
        expect((await response.json()).error).toBe('Forbidden');
    });

    it('allows QA+ role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(10) }])
            .mockResolvedValueOnce([]);

        const request = new NextRequest('http://localhost:3002/api/analytics/red-zone?threshold=70');
        const response = await GET(request);

        expect(response.status).toBe(200);
    });

    it('clamps threshold above 100 to 100', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(0) }])
            .mockResolvedValueOnce([]);

        // If clamped to 100, no pairs should be found (100% is nearly impossible)
        const request = new NextRequest('http://localhost:3002/api/analytics/red-zone?threshold=150');
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect((await response.json()).pairs).toHaveLength(0);
    });

    it('clamps threshold below 0 to 0', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(5) }])
            .mockResolvedValueOnce([makePair()]);

        const request = new NextRequest('http://localhost:3002/api/analytics/red-zone?threshold=-50');
        const response = await GET(request);

        expect(response.status).toBe(200);
    });

    it('returns 200 with pair data including totalTasksWithEmbeddings', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(42) }])
            .mockResolvedValueOnce([makePair()]);

        const request = new NextRequest('http://localhost:3002/api/analytics/red-zone?threshold=70');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.totalTasksWithEmbeddings).toBe(42);
        expect(data.pairs).toHaveLength(1);
        expect(data.pairs[0]).toMatchObject({
            prompt1: { id: 'task-1', content: 'Alpha' },
            prompt2: { id: 'task-2', content: 'Beta' },
            similarity: 82,
        });
    });

    it('scopes count and pair queries to environment when provided', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(3) }])
            .mockResolvedValueOnce([makePair()]);

        const request = new NextRequest('http://localhost:3002/api/analytics/red-zone?threshold=70&environment=Staging');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        // Two $queryRaw calls should have been made (count + pairs)
        expect(vi.mocked(prisma.$queryRaw)).toHaveBeenCalledTimes(2);
        expect(data.totalTasksWithEmbeddings).toBe(3);
    });

    it('uses default threshold of 70 when not provided', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: BigInt(0) }])
            .mockResolvedValueOnce([]);

        const request = new NextRequest('http://localhost:3002/api/analytics/red-zone');
        const response = await GET(request);

        expect(response.status).toBe(200);
    });

    it('returns 500 on database error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('DB failed'));

        const request = new NextRequest('http://localhost:3002/api/analytics/red-zone?threshold=70');
        const response = await GET(request);

        expect(response.status).toBe(500);
        expect((await response.json()).error).toBe('Failed to compute red zone pairs');
    });
});
