import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

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

const mockFlag = {
    id: 'flag-1',
    workerEmail: 'worker@example.com',
    workerName: 'Test Worker',
    flagType: 'QUALITY_CONCERN',
    severity: 'MEDIUM',
    status: 'OPEN',
    reason: 'Quality below threshold',
    notes: null,
    createdById: 'fleet-user-id',
    createdByEmail: 'fleet@example.com',
    createdAt: new Date('2026-03-01'),
    resolvedAt: null,
    resolutionNotes: null,
};

vi.mock('@repo/database', () => ({
    prisma: {
        profile: {
            findUnique: vi.fn(() => ({ role: 'FLEET', email: 'fleet@example.com' })),
        },
        workerFlag: {
            findMany: vi.fn(() => [mockFlag]),
            create: vi.fn(() => mockFlag),
        },
    },
}));

const makeGetRequest = (email: string) =>
    new NextRequest(`http://localhost:3004/api/workforce-monitoring/flags?email=${encodeURIComponent(email)}`);

const makePostRequest = (body: unknown) =>
    new NextRequest('http://localhost:3004/api/workforce-monitoring/flags', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });

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

describe('GET /api/workforce-monitoring/flags', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await mockAuthenticatedUser();
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET', email: 'fleet@example.com' } as any);
        vi.mocked(prisma.workerFlag.findMany).mockResolvedValue([mockFlag] as any);
    });

    it('returns 401 when unauthenticated', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: new Error('no session') })) },
        } as any);

        const res = await GET(makeGetRequest('worker@example.com'));
        expect(res.status).toBe(401);
    });

    it('returns 403 when role is below FLEET', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'CORE' } as any);

        const res = await GET(makeGetRequest('worker@example.com'));
        expect(res.status).toBe(403);
    });

    it('returns 400 when email param is missing', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/workforce-monitoring/flags'));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('email is required');
    });

    it('returns flags for a valid worker email', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);
        vi.mocked(prisma.workerFlag.findMany).mockResolvedValue([mockFlag] as any);

        const res = await GET(makeGetRequest('worker@example.com'));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.flags).toHaveLength(1);
        expect(data.flags[0].flagType).toBe('QUALITY_CONCERN');
    });
});

describe('POST /api/workforce-monitoring/flags', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await mockAuthenticatedUser();
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET', email: 'fleet@example.com' } as any);
        vi.mocked(prisma.workerFlag.create).mockResolvedValue(mockFlag as any);
    });

    it('returns 401 when unauthenticated', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: new Error('no session') })) },
        } as any);

        const res = await POST(makePostRequest({ workerEmail: 'w@example.com', flagType: 'OTHER', reason: 'test' }));
        expect(res.status).toBe(401);
    });

    it('returns 403 when role is below FLEET', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'USER' } as any);

        const res = await POST(makePostRequest({ workerEmail: 'w@example.com', flagType: 'OTHER', reason: 'test' }));
        expect(res.status).toBe(403);
    });

    it('returns 400 when workerEmail is missing', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET', email: 'fleet@example.com' } as any);

        const res = await POST(makePostRequest({ flagType: 'OTHER', reason: 'missing email' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('workerEmail is required');
    });

    it('returns 400 for invalid flagType', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET', email: 'fleet@example.com' } as any);

        const res = await POST(makePostRequest({ workerEmail: 'w@example.com', flagType: 'INVALID_TYPE', reason: 'test' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('flagType must be one of');
    });

    it('returns 400 for invalid severity', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET', email: 'fleet@example.com' } as any);

        const res = await POST(makePostRequest({ workerEmail: 'w@example.com', flagType: 'OTHER', severity: 'EXTREME', reason: 'test' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('severity must be one of');
    });

    it('returns 400 when reason is missing', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET', email: 'fleet@example.com' } as any);

        const res = await POST(makePostRequest({ workerEmail: 'w@example.com', flagType: 'OTHER' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('reason is required');
    });

    it('accepts REVIEW_REQUESTED as a valid flagType', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET', email: 'fleet@example.com' } as any);
        vi.mocked(prisma.workerFlag.create).mockResolvedValue({
            ...mockFlag,
            flagType: 'REVIEW_REQUESTED',
        } as any);

        const res = await POST(makePostRequest({
            workerEmail: 'worker@example.com',
            flagType: 'REVIEW_REQUESTED',
            reason: 'Flagged for review',
        }));

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.flag.flagType).toBe('REVIEW_REQUESTED');
    });

    it('creates a flag with default MEDIUM severity when omitted', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET', email: 'fleet@example.com' } as any);
        vi.mocked(prisma.workerFlag.create).mockResolvedValue(mockFlag as any);

        const res = await POST(makePostRequest({
            workerEmail: 'worker@example.com',
            flagType: 'QUALITY_CONCERN',
            reason: 'Low quality output',
        }));

        expect(res.status).toBe(201);
        expect(prisma.workerFlag.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ severity: 'MEDIUM' }),
            })
        );
    });

    it('creates a flag with all valid flagTypes', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET', email: 'fleet@example.com' } as any);

        const validTypes = ['QUALITY_CONCERN', 'POLICY_VIOLATION', 'COMMUNICATION_ISSUE', 'ATTENDANCE', 'OTHER', 'REVIEW_REQUESTED'];

        for (const flagType of validTypes) {
            vi.mocked(prisma.workerFlag.create).mockResolvedValue({ ...mockFlag, flagType } as any);

            const res = await POST(makePostRequest({
                workerEmail: 'worker@example.com',
                flagType,
                reason: 'Test reason',
            }));

            expect(res.status).toBe(201);
        }
    });
});
