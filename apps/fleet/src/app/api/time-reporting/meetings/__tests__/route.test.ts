import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        meeting: {
            findMany: vi.fn(),
            create: vi.fn()
        }
    }
}));

vi.mock('@repo/core/audit', () => ({ logAudit: vi.fn(() => Promise.resolve({ success: true })) }));

const makeFleetClient = () => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null })) },
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(() => ({ data: { role: 'FLEET', email: 'user@example.com' }, error: null }))
            }))
        }))
    }))
});

beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockImplementation(makeFleetClient as any);
});

const mockMeeting = (overrides = {}) => ({
    id: 'meeting-1',
    title: 'Weekly Sync',
    description: null,
    isRecurring: false,
    recurrencePattern: null,
    expectedDurationHours: null,
    category: 'TEAM',
    isActive: true,
    createdBy: 'user@example.com',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    ...overrides
});

describe('GET /api/time-reporting/meetings', () => {
    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/time-reporting/meetings'));
        expect(res.status).toBe(401);
    });

    it('returns 403 for users without sufficient role', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } }, error: null })) },
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(() => ({ data: { role: 'QA', email: 'qa@example.com' }, error: null }))
                    }))
                }))
            }))
        } as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/time-reporting/meetings'));
        expect(res.status).toBe(403);
    });

    it('returns 200 with meetings array', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.meeting.findMany).mockResolvedValue([mockMeeting()] as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/time-reporting/meetings'));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.meetings).toHaveLength(1);
        expect(data.meetings[0]).toMatchObject({ id: 'meeting-1', title: 'Weekly Sync' });
    });

    it('returns 500 on database error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.meeting.findMany).mockRejectedValue(new Error('DB error'));

        const res = await GET(new NextRequest('http://localhost:3004/api/time-reporting/meetings'));
        expect(res.status).toBe(500);
    });
});

describe('POST /api/time-reporting/meetings', () => {
    const makeRequest = (body: object) =>
        new NextRequest('http://localhost:3004/api/time-reporting/meetings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

    it('returns 400 when title is missing', async () => {
        const res = await POST(makeRequest({ category: 'TEAM' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('Title');
    });

    it('creates a meeting and returns 200 on success', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.meeting.create).mockResolvedValue(mockMeeting() as any);

        const res = await POST(makeRequest({ title: 'Weekly Sync', category: 'TEAM' }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.meeting).toMatchObject({ id: 'meeting-1', title: 'Weekly Sync' });
    });

    it('calls logAudit with MEETING_CREATED including metadata.title, category, isRecurring', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.meeting.create).mockResolvedValue(mockMeeting() as any);

        await POST(makeRequest({ title: 'Weekly Sync', category: 'TEAM', isRecurring: false }));

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'MEETING_CREATED',
                entityType: 'MEETING',
                entityId: 'meeting-1',
                metadata: expect.objectContaining({ title: 'Weekly Sync', category: 'TEAM', isRecurring: false })
            })
        );
    });

    it('does not call logAudit when title is missing', async () => {
        const { logAudit } = await import('@repo/core/audit');
        await POST(makeRequest({ category: 'TEAM' }));
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });
});
