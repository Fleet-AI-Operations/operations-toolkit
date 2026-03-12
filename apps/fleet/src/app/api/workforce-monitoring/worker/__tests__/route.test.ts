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
            findUnique: vi.fn(),
        },
        $queryRaw: vi.fn(),
        dataRecord: {
            count: vi.fn(),
            findMany: vi.fn(),
            findFirst: vi.fn(),
            groupBy: vi.fn(),
        },
        workerFlag: {
            findMany: vi.fn(),
        },
    },
}));

const makeRequest = (params: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3004/api/workforce-monitoring/worker');
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

const sampleTask = {
    id: 'task-1',
    environment: 'test-env',
    content: 'Task content',
    metadata: null,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    alignmentAnalysis: null,
    hasBeenReviewed: false,
};

const sampleFeedback = {
    id: 'feedback-1',
    environment: 'test-env',
    content: 'Feedback content',
    metadata: null,
    createdAt: new Date('2026-03-01T09:00:00Z'),
    alignmentAnalysis: null,
    hasBeenReviewed: false,
};

describe('GET /api/workforce-monitoring/worker', () => {
    beforeEach(async () => {
        // resetAllMocks clears both call history AND mockResolvedValueOnce queues,
        // preventing bleed-through between tests.
        vi.resetAllMocks();
        await mockAuthenticatedUser();
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);
        vi.mocked(prisma.workerFlag.findMany).mockResolvedValue([]);
        vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue({ createdByName: 'Alice Smith' } as any);
        vi.mocked(prisma.dataRecord.groupBy).mockResolvedValue([
            { environment: 'test-env', _count: { _all: 5 } },
        ] as any);
        vi.mocked(prisma.$queryRaw).mockResolvedValue([sampleTask]);
        vi.mocked(prisma.dataRecord.count).mockResolvedValue(1);
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([]);
    });

    it('returns 401 when unauthenticated', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: {
                getUser: vi.fn(() => ({ data: { user: null }, error: new Error('no session') })),
            },
        } as any);

        const res = await GET(makeRequest({ email: 'alice@example.com' }));
        expect(res.status).toBe(401);
        expect((await res.json()).error).toBe('Unauthorized');
    });

    it('returns 403 when role is insufficient (QA)', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'QA' } as any);

        const res = await GET(makeRequest({ email: 'alice@example.com' }));
        expect(res.status).toBe(403);
        expect((await res.json()).error).toBe('Forbidden');
    });

    it('returns 400 when email param is missing', async () => {
        const res = await GET(makeRequest());
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('email is required');
    });

    it('returns 404 when worker not found (no records)', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
        vi.mocked(prisma.dataRecord.count).mockResolvedValue(0);
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([]);
        vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.dataRecord.groupBy).mockResolvedValue([]);

        const res = await GET(makeRequest({ email: 'unknown@example.com' }));
        expect(res.status).toBe(404);
        expect((await res.json()).error).toBe('Worker not found');
    });

    it('returns 200 with tasks and feedback for a valid worker', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValue([sampleTask]);
        vi.mocked(prisma.dataRecord.count).mockResolvedValue(1);
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([sampleFeedback] as any);

        const res = await GET(makeRequest({ email: 'alice@example.com' }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.worker.email).toBe('alice@example.com');
        expect(data.worker.name).toBe('Alice Smith');
        expect(Array.isArray(data.tasks)).toBe(true);
        expect(Array.isArray(data.feedback)).toBe(true);
        expect(Array.isArray(data.flags)).toBe(true);
        expect(Array.isArray(data.environments)).toBe(true);
    });

    it('pagination: page 2 uses correct offset (skip=50 for page=2, limit=50)', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValue([sampleTask]);
        vi.mocked(prisma.dataRecord.count).mockResolvedValue(100);

        const res = await GET(makeRequest({ email: 'alice@example.com', page: '2', limit: '50' }));
        expect(res.status).toBe(200);

        // The $queryRaw call is a tagged template literal. The mock receives
        // (TemplateStringsArray, ...interpolatedValues) as separate arguments.
        // Argument positions: [0]=strings, [1]=email, [2]=envFilter, [3]=limit, [4]=skip
        const callArgs = vi.mocked(prisma.$queryRaw).mock.calls[0];
        const skip = callArgs[4] as number;
        expect(skip).toBe(50); // (page - 1) * limit = (2 - 1) * 50 = 50
    });

    it('latestOnly=true uses the DISTINCT ON query path', async () => {
        const { prisma } = await import('@repo/database');
        // latestOnly path: first $queryRaw = count (returns [{ count }]), second = data rows
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: 1 }])
            .mockResolvedValueOnce([sampleTask]);

        const res = await GET(makeRequest({ email: 'alice@example.com', latestOnly: 'true' }));
        expect(res.status).toBe(200);

        // Both calls should have DISTINCT ON in the SQL strings
        const countStrings = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as string[];
        const dataStrings = vi.mocked(prisma.$queryRaw).mock.calls[1][0] as string[];
        expect(countStrings.join('')).toContain('DISTINCT ON');
        expect(dataStrings.join('')).toContain('DISTINCT ON');
    });

    it('type=FEEDBACK skips the task query entirely', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([sampleFeedback] as any);
        vi.mocked(prisma.dataRecord.count).mockResolvedValue(1);

        const res = await GET(makeRequest({ email: 'alice@example.com', type: 'FEEDBACK' }));
        expect(res.status).toBe(200);

        expect(vi.mocked(prisma.$queryRaw).mock.calls.length).toBe(0);
        const data = await res.json();
        expect(data.totalTasks).toBe(0);
        expect(data.tasks).toHaveLength(0);
    });

    it('type=TASK skips the feedback query entirely', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValue([sampleTask]);
        vi.mocked(prisma.dataRecord.count).mockResolvedValue(1);

        const res = await GET(makeRequest({ email: 'alice@example.com', type: 'TASK' }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.totalFeedback).toBe(0);
        expect(data.feedback).toHaveLength(0);
        // dataRecord.findMany is only used for feedback — must not be called with type=TASK
        expect(vi.mocked(prisma.dataRecord.findMany).mock.calls.length).toBe(0);
    });

    it('environment filter is applied to the task count query', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValue([sampleTask]);
        vi.mocked(prisma.dataRecord.count).mockResolvedValue(1);

        const res = await GET(makeRequest({ email: 'alice@example.com', environment: 'prod-env' }));
        expect(res.status).toBe(200);

        // dataRecord.count (for tasks) is called with the environment in the Prisma where clause
        expect(vi.mocked(prisma.dataRecord.count)).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ environment: 'prod-env' }) })
        );
    });

    it('ORDER BY fix: regular task SQL includes ", id" tiebreaker', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValue([sampleTask]);
        vi.mocked(prisma.dataRecord.count).mockResolvedValue(1);

        await GET(makeRequest({ email: 'alice@example.com' }));

        // mock.calls[0][0] is the TemplateStringsArray — join the parts to get the SQL template
        const strings = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as string[];
        expect(strings.join('')).toContain('"createdAt" DESC, id');
    });

    it('ORDER BY fix: latestOnly outer query includes ", id" tiebreaker', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ count: 1 }])
            .mockResolvedValueOnce([sampleTask]);

        await GET(makeRequest({ email: 'alice@example.com', latestOnly: 'true' }));

        // Second $queryRaw call is the outer SELECT with ORDER BY "createdAt" DESC, id
        const dataStrings = vi.mocked(prisma.$queryRaw).mock.calls[1][0] as string[];
        expect(dataStrings.join('')).toContain('"createdAt" DESC, id');
    });
});
