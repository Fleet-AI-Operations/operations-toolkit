import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn(() => ({
                data: { user: { id: 'user-1' } },
                error: null
            }))
        },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(() => ({
                        data: { role: 'FLEET' },
                        error: null
                    }))
                }))
            }))
        }))
    }))
}));

vi.mock('@repo/database', () => ({
    prisma: {
        mentorshipPodMember: {
            findFirst: vi.fn(),
            delete: vi.fn()
        }
    }
}));

vi.mock('@repo/core/audit', () => ({ logAudit: vi.fn(() => Promise.resolve({ success: true })) }));

const makeParams = (id: string, userId: string) => Promise.resolve({ id, userId });

const makeRequest = () =>
    new NextRequest('http://localhost:3004/api/mentorship/pods/pod-1/members/member-1', {
        method: 'DELETE'
    });

describe('DELETE /api/mentorship/pods/[id]/members/[userId]', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('returns 404 when membership row does not exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPodMember.findFirst).mockResolvedValue(null);

        const res = await DELETE(makeRequest(), { params: makeParams('pod-1', 'member-1') });
        expect(res.status).toBe(404);
        expect((await res.json()).error).toContain('not found');
    });

    it('deletes a member and returns success', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPodMember.findFirst).mockResolvedValue({
            id: 'member-1',
            podId: 'pod-1',
            qaEmail: 'qa@example.com',
            qaName: 'QA Worker',
            joinedAt: new Date()
        } as any);
        vi.mocked(prisma.mentorshipPodMember.delete).mockResolvedValue({} as any);

        const res = await DELETE(makeRequest(), { params: makeParams('pod-1', 'member-1') });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(prisma.mentorshipPodMember.delete).toHaveBeenCalledWith({ where: { id: 'member-1' } });
    });

    it('queries membership by both member id and pod id to prevent cross-pod deletion', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPodMember.findFirst).mockResolvedValue(null);

        await DELETE(makeRequest(), { params: makeParams('pod-1', 'member-1') });

        expect(prisma.mentorshipPodMember.findFirst).toHaveBeenCalledWith({
            where: { id: 'member-1', podId: 'pod-1' }
        });
    });

    it('calls logAudit with POD_MEMBER_REMOVED on successful deletion', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.mentorshipPodMember.findFirst).mockResolvedValue({
            id: 'member-1', podId: 'pod-1', qaEmail: 'qa@example.com', qaName: 'QA Worker', joinedAt: new Date()
        } as any);
        vi.mocked(prisma.mentorshipPodMember.delete).mockResolvedValue({} as any);

        await DELETE(makeRequest(), { params: makeParams('pod-1', 'member-1') });

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'POD_MEMBER_REMOVED', entityType: 'MENTORSHIP_POD', entityId: 'pod-1', metadata: expect.objectContaining({ qaEmail: 'qa@example.com' }) })
        );
    });

    it('does not call logAudit when member is not found', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.mentorshipPodMember.findFirst).mockResolvedValue(null);

        await DELETE(makeRequest(), { params: makeParams('pod-1', 'member-1') });
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await DELETE(makeRequest(), { params: makeParams('pod-1', 'member-1') });
        expect(res.status).toBe(401);
    });

    it('returns 403 for users with insufficient role', async () => {
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

        const res = await DELETE(makeRequest(), { params: makeParams('pod-1', 'member-1') });
        expect(res.status).toBe(403);
    });
});
