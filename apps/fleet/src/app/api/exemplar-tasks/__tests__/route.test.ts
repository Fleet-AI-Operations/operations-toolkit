import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        exemplarTask: {
            create: vi.fn()
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

const mockExemplar = (overrides = {}) => ({
    id: 'exemplar-1',
    environment: 'env1',
    content: 'Sample task content',
    createdById: 'user-1',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    ...overrides
});

describe('GET /api/exemplar-tasks', () => {
    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/exemplar-tasks'));
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

        const res = await GET(new NextRequest('http://localhost:3004/api/exemplar-tasks'));
        expect(res.status).toBe(403);
    });

    it('returns 200 with exemplars list including hasEmbedding boolean', async () => {
        const { prisma } = await import('@repo/database');
        const exemplarRows = [{ ...mockExemplar(), hasEmbedding: true }];
        vi.mocked(prisma.$queryRaw).mockResolvedValue(exemplarRows as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/exemplar-tasks'));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.exemplars).toHaveLength(1);
        expect(data.exemplars[0]).toMatchObject({ id: 'exemplar-1', hasEmbedding: true });
    });
});

describe('POST /api/exemplar-tasks', () => {
    const makeRequest = (body: object) =>
        new NextRequest('http://localhost:3004/api/exemplar-tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

    it('returns 400 when environment is missing', async () => {
        const res = await POST(makeRequest({ content: 'Some content' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('environment');
    });

    it('returns 400 when content is missing', async () => {
        const res = await POST(makeRequest({ environment: 'env1' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('content');
    });

    it('creates exemplar task and returns 201 on success', async () => {
        const { prisma } = await import('@repo/database');
        const { getEmbedding } = await import('@repo/core/ai');
        vi.mocked(prisma.exemplarTask.create).mockResolvedValue(mockExemplar() as any);
        vi.mocked(getEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
        vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as any);

        const res = await POST(makeRequest({ environment: 'env1', content: 'Sample task content' }));
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.exemplar).toMatchObject({ id: 'exemplar-1', environment: 'env1' });
    });

    it('calls logAudit with EXEMPLAR_TASK_CREATED on success', async () => {
        const { prisma } = await import('@repo/database');
        const { getEmbedding } = await import('@repo/core/ai');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.exemplarTask.create).mockResolvedValue(mockExemplar() as any);
        vi.mocked(getEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
        vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as any);

        await POST(makeRequest({ environment: 'env1', content: 'Sample task content' }));

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'EXEMPLAR_TASK_CREATED', entityType: 'EXEMPLAR_TASK', entityId: 'exemplar-1' })
        );
    });

    it('does not call logAudit when validation fails', async () => {
        const { logAudit } = await import('@repo/core/audit');
        await POST(makeRequest({ environment: 'env1' }));
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });
});
