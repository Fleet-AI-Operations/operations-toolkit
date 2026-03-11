import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        mentorshipPod: {
            findMany: vi.fn()
        },
        qAFeedbackRating: {
            findMany: vi.fn()
        }
    }
}));

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

const mockPodRow = (overrides = {}) => ({
    id: 'pod-1',
    name: 'Pod Alpha',
    createdAt: new Date('2026-03-01'),
    coreLeader: { id: 'leader-1', email: 'leader@example.com', firstName: 'Alice', lastName: 'Smith' },
    members: [],
    ...overrides
});

beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockImplementation(makeFleetClient as any);
});

describe('GET /api/mentorship/dashboard', () => {
    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/dashboard'));
        expect(res.status).toBe(401);
    });

    it('returns 403 for users without FLEET/MANAGER/ADMIN role', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } }, error: null })) },
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(() => ({ data: { role: 'CORE' }, error: null }))
                    }))
                }))
            }))
        } as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/dashboard'));
        expect(res.status).toBe(403);
    });

    it('returns pods with windowDays and asOf', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findMany).mockResolvedValue([mockPodRow()] as any);
        vi.mocked(prisma.qAFeedbackRating.findMany).mockResolvedValue([]);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/dashboard'));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pods).toHaveLength(1);
        expect(data.windowDays).toBe(7);
        expect(data.asOf).toBeDefined();
    });

    it('calculates positive feedback rate per member', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findMany).mockResolvedValue([
            mockPodRow({
                members: [{ id: 'mem-1', qaEmail: 'qa@example.com', qaName: 'QA Worker', joinedAt: new Date() }]
            })
        ] as any);
        vi.mocked(prisma.qAFeedbackRating.findMany).mockResolvedValue([
            { qaEmail: 'qa@example.com', isHelpful: true },
            { qaEmail: 'qa@example.com', isHelpful: true },
            { qaEmail: 'qa@example.com', isHelpful: false }
        ] as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/dashboard'));
        const data = await res.json();

        const member = data.pods[0].members[0];
        expect(member.totalRatings).toBe(3);
        expect(member.positiveRatings).toBe(2);
        expect(member.positiveFeedbackRate).toBe(67); // Math.round(2/3 * 100)
    });

    it('returns null positiveFeedbackRate when member has no ratings', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findMany).mockResolvedValue([
            mockPodRow({
                members: [{ id: 'mem-1', qaEmail: 'qa@example.com', qaName: 'QA Worker', joinedAt: new Date() }]
            })
        ] as any);
        vi.mocked(prisma.qAFeedbackRating.findMany).mockResolvedValue([]);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/dashboard'));
        const data = await res.json();

        expect(data.pods[0].members[0].positiveFeedbackRate).toBeNull();
        expect(data.pods[0].podPositiveRate).toBeNull();
    });

    it('calculates pod-level positive rate across all members', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findMany).mockResolvedValue([
            mockPodRow({
                members: [
                    { id: 'mem-1', qaEmail: 'qa1@example.com', qaName: 'QA One', joinedAt: new Date() },
                    { id: 'mem-2', qaEmail: 'qa2@example.com', qaName: 'QA Two', joinedAt: new Date() }
                ]
            })
        ] as any);
        // qa1: 3 ratings, 3 positive; qa2: 1 rating, 0 positive → pod: 3/4 = 75%
        vi.mocked(prisma.qAFeedbackRating.findMany).mockResolvedValue([
            { qaEmail: 'qa1@example.com', isHelpful: true },
            { qaEmail: 'qa1@example.com', isHelpful: true },
            { qaEmail: 'qa1@example.com', isHelpful: true },
            { qaEmail: 'qa2@example.com', isHelpful: false }
        ] as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/dashboard'));
        const data = await res.json();

        expect(data.pods[0].podPositiveRate).toBe(75);
    });

    it('skips qAFeedbackRating query when no members exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findMany).mockResolvedValue([mockPodRow()] as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/dashboard'));
        await res.json();

        expect(prisma.qAFeedbackRating.findMany).not.toHaveBeenCalled();
    });

    it('returns 500 on database error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.mentorshipPod.findMany).mockRejectedValue(new Error('DB error'));

        const res = await GET(new NextRequest('http://localhost:3004/api/mentorship/dashboard'));
        expect(res.status).toBe(500);
    });
});
