import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        promptAuthenticityRecord: {
            count: vi.fn(),
            deleteMany: vi.fn()
        },
        promptAuthenticityJob: {
            count: vi.fn(),
            deleteMany: vi.fn()
        },
        $transaction: vi.fn()
    }
}));

vi.mock('@repo/core/audit', () => ({ logAudit: vi.fn(() => Promise.resolve({ success: true })) }));

const makeAdminClient = () => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null })) },
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(() => ({ data: { role: 'ADMIN' }, error: null }))
            }))
        }))
    }))
});

beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockImplementation(makeAdminClient as any);
});

describe('DELETE /api/prompt-authenticity/clear', () => {
    const makeRequest = (body: object) =>
        new NextRequest('http://localhost:3004/api/prompt-authenticity/clear', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await DELETE(makeRequest({ confirmText: 'DELETE ALL DATA' }));
        expect(res.status).toBe(401);
    });

    it('returns 403 for FLEET role (not admin enough)', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } }, error: null })) },
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(() => ({ data: { role: 'FLEET' }, error: null }))
                    }))
                }))
            }))
        } as any);

        const res = await DELETE(makeRequest({ confirmText: 'DELETE ALL DATA' }));
        expect(res.status).toBe(403);
    });

    it('returns 400 when confirmText is not exactly DELETE ALL DATA', async () => {
        const res = await DELETE(makeRequest({ confirmText: 'delete all data' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('DELETE ALL DATA');
    });

    it('returns 200 with recordsDeleted and jobsDeleted on success', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.promptAuthenticityRecord.count).mockResolvedValue(10);
        vi.mocked(prisma.promptAuthenticityJob.count).mockResolvedValue(3);
        vi.mocked(prisma.$transaction).mockResolvedValue([undefined, undefined] as any);

        const res = await DELETE(makeRequest({ confirmText: 'DELETE ALL DATA' }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.recordsDeleted).toBe(10);
        expect(data.jobsDeleted).toBe(3);
    });

    it('calls logAudit with PROMPT_AUTHENTICITY_CLEARED on success', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.promptAuthenticityRecord.count).mockResolvedValue(10);
        vi.mocked(prisma.promptAuthenticityJob.count).mockResolvedValue(3);
        vi.mocked(prisma.$transaction).mockResolvedValue([undefined, undefined] as any);

        await DELETE(makeRequest({ confirmText: 'DELETE ALL DATA' }));

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'PROMPT_AUTHENTICITY_CLEARED',
                entityType: 'PROMPT_AUTHENTICITY_RECORD'
            })
        );
    });
});

describe('GET /api/prompt-authenticity/clear', () => {
    const makeRequest = () =>
        new NextRequest('http://localhost:3004/api/prompt-authenticity/clear');

    it('returns 403 for non-admin users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } }, error: null })) },
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(() => ({ data: { role: 'FLEET' }, error: null }))
                    }))
                }))
            }))
        } as any);

        const res = await GET(makeRequest());
        expect(res.status).toBe(403);
    });

    it('returns 200 with stats for admin users', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.promptAuthenticityRecord.count)
            .mockResolvedValueOnce(100) // totalRecords
            .mockResolvedValueOnce(20)  // pendingRecords
            .mockResolvedValueOnce(75); // completedRecords
        vi.mocked(prisma.promptAuthenticityJob.count).mockResolvedValue(5);

        const res = await GET(makeRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toMatchObject({
            totalRecords: 100,
            totalJobs: 5,
            pendingRecords: 20,
            completedRecords: 75
        });
    });
});
