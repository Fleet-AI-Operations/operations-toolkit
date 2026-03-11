import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

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
        mentorshipPod: {
            findUnique: vi.fn()
        },
        mentorshipPodMember: {
            createMany: vi.fn()
        }
    }
}));

vi.mock('@repo/core/audit', () => ({ logAudit: vi.fn(() => Promise.resolve({ success: true })) }));

const makeParams = (id: string) => Promise.resolve({ id });

const makeRequest = (body: object) =>
    new NextRequest('http://localhost:3004/api/mentorship/pods/pod-1/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

describe('POST /api/mentorship/pods/[id]/members', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('returns 400 when members is not an array', async () => {
        const res = await POST(makeRequest({ members: 'not-an-array' }), { params: makeParams('pod-1') });
        expect(res.status).toBe(400);
    });

    it('returns 400 when members array is empty', async () => {
        const res = await POST(makeRequest({ members: [] }), { params: makeParams('pod-1') });
        expect(res.status).toBe(400);
    });

    it('returns 400 when a member is missing qaEmail', async () => {
        const res = await POST(makeRequest({ members: [{ qaName: 'No Email' }] }), { params: makeParams('pod-1') });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('qaEmail');
    });

    it('returns 400 when qaEmail is an empty string', async () => {
        const res = await POST(makeRequest({ members: [{ qaEmail: '   ' }] }), { params: makeParams('pod-1') });
        expect(res.status).toBe(400);
    });

    it('returns 404 when pod does not exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(null);

        const res = await POST(
            makeRequest({ members: [{ qaEmail: 'qa@example.com', qaName: 'QA Worker' }] }),
            { params: makeParams('pod-1') }
        );
        expect(res.status).toBe(404);
    });

    it('adds members and returns actual inserted count', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue({ id: 'pod-1' } as any);
        // Simulate 1 skip (duplicate) — only 2 of 3 actually inserted
        vi.mocked(prisma.mentorshipPodMember.createMany).mockResolvedValue({ count: 2 });

        const res = await POST(
            makeRequest({
                members: [
                    { qaEmail: 'qa1@example.com', qaName: 'QA One' },
                    { qaEmail: 'qa2@example.com', qaName: 'QA Two' },
                    { qaEmail: 'qa1@example.com', qaName: 'QA One (dup)' }
                ]
            }),
            { params: makeParams('pod-1') }
        );
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.added).toBe(2);
    });

    it('normalises email to lowercase', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue({ id: 'pod-1' } as any);
        vi.mocked(prisma.mentorshipPodMember.createMany).mockResolvedValue({ count: 1 });

        await POST(
            makeRequest({ members: [{ qaEmail: 'QA@Example.COM', qaName: 'QA Worker' }] }),
            { params: makeParams('pod-1') }
        );

        expect(prisma.mentorshipPodMember.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({ qaEmail: 'qa@example.com' })
                ])
            })
        );
    });

    it('stores null for missing qaName', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue({ id: 'pod-1' } as any);
        vi.mocked(prisma.mentorshipPodMember.createMany).mockResolvedValue({ count: 1 });

        await POST(
            makeRequest({ members: [{ qaEmail: 'qa@example.com' }] }),
            { params: makeParams('pod-1') }
        );

        expect(prisma.mentorshipPodMember.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({ qaName: null })
                ])
            })
        );
    });

    it('calls logAudit with POD_MEMBERS_ADDED on success', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue({ id: 'pod-1' } as any);
        vi.mocked(prisma.mentorshipPodMember.createMany).mockResolvedValue({ count: 2 });

        await POST(
            makeRequest({ members: [{ qaEmail: 'qa1@example.com' }, { qaEmail: 'qa2@example.com' }] }),
            { params: makeParams('pod-1') }
        );

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'POD_MEMBERS_ADDED', entityType: 'MENTORSHIP_POD', entityId: 'pod-1', metadata: expect.objectContaining({ added: 2 }) })
        );
    });

    it('does not call logAudit when pod is not found', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.mentorshipPod.findUnique).mockResolvedValue(null);

        await POST(makeRequest({ members: [{ qaEmail: 'qa@example.com' }] }), { params: makeParams('pod-1') });
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await POST(
            makeRequest({ members: [{ qaEmail: 'qa@example.com' }] }),
            { params: makeParams('pod-1') }
        );
        expect(res.status).toBe(401);
    });
});
