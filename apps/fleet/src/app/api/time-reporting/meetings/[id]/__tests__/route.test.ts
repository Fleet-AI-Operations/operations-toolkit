import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT, DELETE } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        meeting: {
            update: vi.fn(),
            delete: vi.fn()
        }
    }
}));

vi.mock('@repo/core/audit', () => ({ logAudit: vi.fn(() => Promise.resolve({ success: true })) }));

const makeFleetClient = () => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null })) },
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(() => ({ data: { role: 'FLEET' }, error: null }))
            }))
        }))
    }))
});

beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockImplementation(makeFleetClient as any);
});

const makeParams = (id: string) => Promise.resolve({ id });

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

describe('PUT /api/time-reporting/meetings/[id]', () => {
    const makeRequest = (body: object) =>
        new NextRequest('http://localhost:3004/api/time-reporting/meetings/meeting-1', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await PUT(makeRequest({ title: 'Updated' }), { params: makeParams('meeting-1') });
        expect(res.status).toBe(401);
    });

    it('returns 403 for users without sufficient role', async () => {
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

        const res = await PUT(makeRequest({ title: 'Updated' }), { params: makeParams('meeting-1') });
        expect(res.status).toBe(403);
    });

    it('returns 400 when title is missing', async () => {
        const res = await PUT(makeRequest({ category: 'TEAM' }), { params: makeParams('meeting-1') });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('Title');
    });

    it('returns 404 via P2025 error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.meeting.update).mockRejectedValue(
            Object.assign(new Error('not found'), { code: 'P2025' })
        );

        const res = await PUT(makeRequest({ title: 'Updated' }), { params: makeParams('meeting-1') });
        expect(res.status).toBe(404);
    });

    it('returns 200 on successful update', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.meeting.update).mockResolvedValue(mockMeeting({ title: 'Updated' }) as any);

        const res = await PUT(makeRequest({ title: 'Updated' }), { params: makeParams('meeting-1') });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('calls logAudit with MEETING_UPDATED on success', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.meeting.update).mockResolvedValue(mockMeeting({ title: 'Updated' }) as any);

        await PUT(makeRequest({ title: 'Updated' }), { params: makeParams('meeting-1') });

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'MEETING_UPDATED', entityType: 'MEETING', entityId: 'meeting-1' })
        );
    });

    it('does not call logAudit on P2025 error', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.meeting.update).mockRejectedValue(
            Object.assign(new Error('not found'), { code: 'P2025' })
        );

        await PUT(makeRequest({ title: 'Updated' }), { params: makeParams('meeting-1') });
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });
});

describe('DELETE /api/time-reporting/meetings/[id]', () => {
    const makeRequest = () =>
        new NextRequest('http://localhost:3004/api/time-reporting/meetings/meeting-1', { method: 'DELETE' });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await DELETE(makeRequest(), { params: makeParams('meeting-1') });
        expect(res.status).toBe(401);
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

        const res = await DELETE(makeRequest(), { params: makeParams('meeting-1') });
        expect(res.status).toBe(403);
    });

    it('returns 404 via P2025 error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.meeting.delete).mockRejectedValue(
            Object.assign(new Error('not found'), { code: 'P2025' })
        );

        const res = await DELETE(makeRequest(), { params: makeParams('meeting-1') });
        expect(res.status).toBe(404);
    });

    it('returns 200 on successful deletion', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.meeting.delete).mockResolvedValue(mockMeeting() as any);

        const res = await DELETE(makeRequest(), { params: makeParams('meeting-1') });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('calls logAudit with MEETING_DELETED on success', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.meeting.delete).mockResolvedValue(mockMeeting() as any);

        await DELETE(makeRequest(), { params: makeParams('meeting-1') });

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'MEETING_DELETED', entityType: 'MEETING', entityId: 'meeting-1' })
        );
    });

    it('does not call logAudit on P2025 error', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.meeting.delete).mockRejectedValue(
            Object.assign(new Error('not found'), { code: 'P2025' })
        );

        await DELETE(makeRequest(), { params: makeParams('meeting-1') });
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });
});
