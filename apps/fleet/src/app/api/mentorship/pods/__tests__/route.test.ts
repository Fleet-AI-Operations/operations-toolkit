import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        mentorshipPod: {
            findMany: vi.fn(),
            create: vi.fn()
        },
        profile: {
            findUnique: vi.fn()
        }
    }
}));

vi.mock('@repo/core/audit', () => ({ logAudit: vi.fn(() => Promise.resolve({ success: true })) }));

const makeFleetClient = () => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(() => ({ data: { role: 'FLEET' }, error: null }))
            }))
        }))
    }))
});

const mockPod = (overrides = {}) => ({
    id: 'pod-1',
    name: 'Pod Alpha',
    coreLeader: { id: 'leader-1', email: 'leader@example.com', firstName: 'Alice', lastName: 'Smith' },
    members: [],
    createdAt: new Date('2026-03-01'),
    ...overrides
});

beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockImplementation(makeFleetClient as any);
});

describe('GET /api/mentorship/pods', () => {
    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/pods'));
        expect(res.status).toBe(401);
        expect((await res.json()).error).toBe('Unauthorized');
    });

    it('returns 403 for users without sufficient role', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } }, error: null })) },
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(() => ({ data: { role: 'QA' }, error: null }))
                    }))
                }))
            }))
        } as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/pods'));
        expect(res.status).toBe(403);
    });

    it('returns pods list', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findMany).mockResolvedValue([mockPod()] as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/pods'));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pods).toHaveLength(1);
        expect(data.pods[0]).toMatchObject({ id: 'pod-1', name: 'Pod Alpha' });
    });

    it('returns empty list when no pods exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findMany).mockResolvedValue([]);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/pods'));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pods).toHaveLength(0);
    });

    it('returns 500 on database error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findMany).mockRejectedValue(new Error('DB error'));

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/pods'));
        expect(res.status).toBe(500);
    });
});

describe('POST /api/mentorship/pods', () => {
    const makeRequest = (body: object) =>
        new NextRequest('http://localhost:3004/api/mentorship/pods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

    it('returns 400 when name is missing', async () => {
        const res = await POST(makeRequest({ coreLeaderId: 'leader-1' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('name');
    });

    it('returns 400 when coreLeaderId is missing', async () => {
        const res = await POST(makeRequest({ name: 'Pod Beta' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('leader');
    });

    it('returns 404 when core leader profile does not exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);

        const res = await POST(makeRequest({ name: 'Pod Beta', coreLeaderId: 'nonexistent' }));
        expect(res.status).toBe(404);
    });

    it('creates a pod and returns 201', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ id: 'leader-1' } as any);
        vi.mocked(prisma.mentorshipPod.create).mockResolvedValue(mockPod() as any);

        const res = await POST(makeRequest({ name: 'Pod Alpha', coreLeaderId: 'leader-1' }));
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.pod).toMatchObject({ id: 'pod-1', name: 'Pod Alpha' });
    });

    it('calls logAudit with POD_CREATED on successful creation', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ id: 'leader-1' } as any);
        vi.mocked(prisma.mentorshipPod.create).mockResolvedValue(mockPod() as any);

        await POST(makeRequest({ name: 'Pod Alpha', coreLeaderId: 'leader-1' }));

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'POD_CREATED', entityType: 'MENTORSHIP_POD', entityId: 'pod-1' })
        );
    });

    it('does not call logAudit when validation fails', async () => {
        const { logAudit } = await import('@repo/core/audit');
        await POST(makeRequest({ coreLeaderId: 'leader-1' }));
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });

    it('trims whitespace from pod name', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ id: 'leader-1' } as any);
        vi.mocked(prisma.mentorshipPod.create).mockResolvedValue(mockPod({ name: 'Pod Alpha' }) as any);

        const res = await POST(makeRequest({ name: '  Pod Alpha  ', coreLeaderId: 'leader-1' }));
        expect(res.status).toBe(201);

        expect(prisma.mentorshipPod.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ name: 'Pod Alpha' }) })
        );
    });
});
