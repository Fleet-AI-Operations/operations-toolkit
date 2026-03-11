import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        mentorshipPod: {
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
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
    ...overrides
});

const makeParams = (id: string) => Promise.resolve({ id });

beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockImplementation(makeFleetClient as any);
});

describe('PATCH /api/mentorship/pods/[id]', () => {
    const makeRequest = (body: object) =>
        new NextRequest('http://localhost:3004/api/mentorship/pods/pod-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await PATCH(makeRequest({ name: 'X' }), { params: makeParams('pod-1') });
        expect(res.status).toBe(401);
    });

    it('returns 404 when pod does not exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(null);

        const res = await PATCH(makeRequest({ name: 'New Name' }), { params: makeParams('pod-1') });
        expect(res.status).toBe(404);
    });

    it('returns 404 when new coreLeaderId does not exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(mockPod() as any);
        vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);

        const res = await PATCH(makeRequest({ coreLeaderId: 'ghost-leader' }), { params: makeParams('pod-1') });
        expect(res.status).toBe(404);
        expect((await res.json()).error).toContain('leader');
    });

    it('updates pod name', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(mockPod() as any);
        vi.mocked(prisma.mentorshipPod.update).mockResolvedValue(mockPod({ name: 'Pod Beta' }) as any);

        const res = await PATCH(makeRequest({ name: 'Pod Beta' }), { params: makeParams('pod-1') });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pod.name).toBe('Pod Beta');
    });

    it('updates core leader', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(mockPod() as any);
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ id: 'leader-2' } as any);
        vi.mocked(prisma.mentorshipPod.update).mockResolvedValue(mockPod() as any);

        const res = await PATCH(makeRequest({ coreLeaderId: 'leader-2' }), { params: makeParams('pod-1') });
        expect(res.status).toBe(200);
        expect(prisma.mentorshipPod.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ coreLeaderId: 'leader-2' }) })
        );
    });

    it('calls logAudit with POD_UPDATED on successful update', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(mockPod() as any);
        vi.mocked(prisma.mentorshipPod.update).mockResolvedValue(mockPod({ name: 'Pod Beta' }) as any);

        await PATCH(makeRequest({ name: 'Pod Beta' }), { params: makeParams('pod-1') });

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'POD_UPDATED', entityType: 'MENTORSHIP_POD', entityId: 'pod-1' })
        );
    });

    it('does not call logAudit when pod is not found', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(null);

        await PATCH(makeRequest({ name: 'X' }), { params: makeParams('pod-1') });
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });

    it('skips coreLeaderId validation when not provided', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(mockPod() as any);
        vi.mocked(prisma.mentorshipPod.update).mockResolvedValue(mockPod({ name: 'Renamed' }) as any);

        const res = await PATCH(makeRequest({ name: 'Renamed' }), { params: makeParams('pod-1') });
        expect(res.status).toBe(200);
        expect(prisma.profile.findUnique).not.toHaveBeenCalled();
    });
});

describe('DELETE /api/mentorship/pods/[id]', () => {
    const makeRequest = () =>
        new NextRequest('http://localhost:3004/api/mentorship/pods/pod-1', { method: 'DELETE' });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await DELETE(makeRequest(), { params: makeParams('pod-1') });
        expect(res.status).toBe(401);
    });

    it('returns 404 when pod does not exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(null);

        const res = await DELETE(makeRequest(), { params: makeParams('pod-1') });
        expect(res.status).toBe(404);
    });

    it('deletes an existing pod', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(mockPod() as any);
        vi.mocked(prisma.mentorshipPod.delete).mockResolvedValue(mockPod() as any);

        const res = await DELETE(makeRequest(), { params: makeParams('pod-1') });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(prisma.mentorshipPod.delete).toHaveBeenCalledWith({ where: { id: 'pod-1' } });
    });

    it('returns 500 on database error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(mockPod() as any);
        vi.mocked(prisma.mentorshipPod.delete).mockRejectedValue(new Error('DB error'));

        const res = await DELETE(makeRequest(), { params: makeParams('pod-1') });
        expect(res.status).toBe(500);
    });

    it('calls logAudit with POD_DELETED on successful deletion', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(mockPod() as any);
        vi.mocked(prisma.mentorshipPod.delete).mockResolvedValue(mockPod() as any);

        await DELETE(makeRequest(), { params: makeParams('pod-1') });

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'POD_DELETED', entityType: 'MENTORSHIP_POD', entityId: 'pod-1', metadata: expect.objectContaining({ name: 'Pod Alpha' }) })
        );
    });

    it('does not call logAudit when pod is not found', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(null);

        await DELETE(makeRequest(), { params: makeParams('pod-1') });
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });
});
