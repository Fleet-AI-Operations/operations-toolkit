import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        exemplarTask: {
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        $queryRaw: vi.fn(),
        $executeRaw: vi.fn()
    }
}));

vi.mock('@repo/core/ai', () => ({ getEmbedding: vi.fn() }));

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

const mockExemplar = (overrides = {}) => ({
    id: 'exemplar-1',
    environment: 'env1',
    content: 'old content',
    createdById: 'user-1',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    ...overrides
});

describe('PATCH /api/exemplar-tasks/[id]', () => {
    const makeRequest = (body: object) =>
        new NextRequest('http://localhost:3004/api/exemplar-tasks/exemplar-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await PATCH(makeRequest({ content: 'new content' }), { params: makeParams('exemplar-1') });
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

        const res = await PATCH(makeRequest({ content: 'new content' }), { params: makeParams('exemplar-1') });
        expect(res.status).toBe(403);
    });

    it('returns 404 when exemplar task is not found', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.exemplarTask.findUnique).mockResolvedValue(null);

        const res = await PATCH(makeRequest({ content: 'new content' }), { params: makeParams('exemplar-1') });
        expect(res.status).toBe(404);
    });

    it('returns 400 for empty content', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.exemplarTask.findUnique).mockResolvedValue(mockExemplar() as any);

        const res = await PATCH(makeRequest({ content: '   ' }), { params: makeParams('exemplar-1') });
        expect(res.status).toBe(400);
    });

    it('returns 200 on successful update', async () => {
        const { prisma } = await import('@repo/database');
        const { getEmbedding } = await import('@repo/core/ai');
        vi.mocked(prisma.exemplarTask.findUnique).mockResolvedValue(mockExemplar() as any);
        vi.mocked(prisma.exemplarTask.update).mockResolvedValue(mockExemplar({ content: 'new content' }) as any);
        vi.mocked(getEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
        vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as any);

        const res = await PATCH(makeRequest({ content: 'new content' }), { params: makeParams('exemplar-1') });
        expect(res.status).toBe(200);
    });

    it('calls logAudit with EXEMPLAR_TASK_UPDATED with contentChanged: true when content changed', async () => {
        const { prisma } = await import('@repo/database');
        const { getEmbedding } = await import('@repo/core/ai');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.exemplarTask.findUnique).mockResolvedValue(mockExemplar({ content: 'old content' }) as any);
        vi.mocked(prisma.exemplarTask.update).mockResolvedValue(mockExemplar({ content: 'new content' }) as any);
        vi.mocked(getEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
        vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as any);

        await PATCH(makeRequest({ content: 'new content' }), { params: makeParams('exemplar-1') });

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'EXEMPLAR_TASK_UPDATED',
                entityType: 'EXEMPLAR_TASK',
                entityId: 'exemplar-1',
                metadata: expect.objectContaining({ contentChanged: true })
            })
        );
    });

    it('does not call logAudit when exemplar task is not found', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.exemplarTask.findUnique).mockResolvedValue(null);

        await PATCH(makeRequest({ content: 'new content' }), { params: makeParams('exemplar-1') });
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });
});

describe('DELETE /api/exemplar-tasks/[id]', () => {
    const makeRequest = () =>
        new NextRequest('http://localhost:3004/api/exemplar-tasks/exemplar-1', { method: 'DELETE' });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await DELETE(makeRequest(), { params: makeParams('exemplar-1') });
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

        const res = await DELETE(makeRequest(), { params: makeParams('exemplar-1') });
        expect(res.status).toBe(403);
    });

    it('returns 404 via P2025 error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.exemplarTask.delete).mockRejectedValue(
            Object.assign(new Error('not found'), { code: 'P2025' })
        );

        const res = await DELETE(makeRequest(), { params: makeParams('exemplar-1') });
        expect(res.status).toBe(404);
        expect((await res.json()).error).toContain('not found');
    });

    it('returns 200 on successful deletion', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.exemplarTask.delete).mockResolvedValue(mockExemplar() as any);

        const res = await DELETE(makeRequest(), { params: makeParams('exemplar-1') });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('calls logAudit with EXEMPLAR_TASK_DELETED on success', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.exemplarTask.delete).mockResolvedValue(mockExemplar() as any);

        await DELETE(makeRequest(), { params: makeParams('exemplar-1') });

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'EXEMPLAR_TASK_DELETED', entityType: 'EXEMPLAR_TASK', entityId: 'exemplar-1' })
        );
    });

    it('does not call logAudit on P2025 error', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.exemplarTask.delete).mockRejectedValue(
            Object.assign(new Error('not found'), { code: 'P2025' })
        );

        await DELETE(makeRequest(), { params: makeParams('exemplar-1') });
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });
});
