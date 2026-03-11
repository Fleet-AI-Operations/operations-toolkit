import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        profile: {
            findUnique: vi.fn()
        },
        guideline: {
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        }
    }
}));

vi.mock('@repo/core/audit', () => ({ logAudit: vi.fn(() => Promise.resolve({ success: true })) }));

const makeFleetClient = () => ({
    auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null })) }
});

beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockImplementation(makeFleetClient as any);

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);
});

const makeParams = (id: string) => Promise.resolve({ id });

const mockGuideline = (overrides = {}) => ({
    id: 'guideline-1',
    name: 'Test Guideline',
    environments: ['env1'],
    content: 'data:application/pdf;base64,abc',
    uploadedBy: 'user-1',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    users: [{ email: 'user@example.com' }],
    ...overrides
});

describe('GET /api/guidelines/[id]', () => {
    const makeRequest = () =>
        new NextRequest('http://localhost:3004/api/guidelines/guideline-1');

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await GET(makeRequest(), { params: makeParams('guideline-1') });
        expect(res.status).toBe(401);
    });

    it('returns 403 for users without sufficient role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'QA' } as any);

        const res = await GET(makeRequest(), { params: makeParams('guideline-1') });
        expect(res.status).toBe(403);
    });

    it('returns 404 when guideline is not found', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.guideline.findUnique).mockResolvedValue(null);

        const res = await GET(makeRequest(), { params: makeParams('guideline-1') });
        expect(res.status).toBe(404);
        expect((await res.json()).error).toContain('not found');
    });

    it('returns 200 with guideline', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.guideline.findUnique).mockResolvedValue(mockGuideline() as any);

        const res = await GET(makeRequest(), { params: makeParams('guideline-1') });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.guideline).toMatchObject({ id: 'guideline-1', name: 'Test Guideline' });
    });
});

describe('PATCH /api/guidelines/[id]', () => {
    const makeRequest = (body: object) =>
        new NextRequest('http://localhost:3004/api/guidelines/guideline-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await PATCH(makeRequest({ name: 'Updated' }), { params: makeParams('guideline-1') });
        expect(res.status).toBe(401);
    });

    it('returns 403 for users without sufficient role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'CORE' } as any);

        const res = await PATCH(makeRequest({ name: 'Updated' }), { params: makeParams('guideline-1') });
        expect(res.status).toBe(403);
    });

    it('returns 404 when guideline is not found', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.guideline.findUnique).mockResolvedValue(null);

        const res = await PATCH(makeRequest({ name: 'Updated' }), { params: makeParams('guideline-1') });
        expect(res.status).toBe(404);
    });

    it('returns 200 on successful update', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.guideline.findUnique).mockResolvedValue(mockGuideline() as any);
        vi.mocked(prisma.guideline.update).mockResolvedValue(mockGuideline({ name: 'Updated' }) as any);

        const res = await PATCH(makeRequest({ name: 'Updated' }), { params: makeParams('guideline-1') });
        expect(res.status).toBe(200);
    });

    it('calls logAudit with GUIDELINE_UPDATED on success', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.guideline.findUnique).mockResolvedValue(mockGuideline() as any);
        vi.mocked(prisma.guideline.update).mockResolvedValue(mockGuideline({ name: 'Updated' }) as any);

        await PATCH(makeRequest({ name: 'Updated' }), { params: makeParams('guideline-1') });

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'GUIDELINE_UPDATED', entityType: 'GUIDELINE', entityId: 'guideline-1' })
        );
    });

    it('does not call logAudit when guideline is not found', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.guideline.findUnique).mockResolvedValue(null);

        await PATCH(makeRequest({ name: 'Updated' }), { params: makeParams('guideline-1') });
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });
});

describe('DELETE /api/guidelines/[id]', () => {
    const makeRequest = () =>
        new NextRequest('http://localhost:3004/api/guidelines/guideline-1', { method: 'DELETE' });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await DELETE(makeRequest(), { params: makeParams('guideline-1') });
        expect(res.status).toBe(401);
    });

    it('returns 403 for users without sufficient role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'QA' } as any);

        const res = await DELETE(makeRequest(), { params: makeParams('guideline-1') });
        expect(res.status).toBe(403);
    });

    it('returns 404 when guideline is not found', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.guideline.findUnique).mockResolvedValue(null);

        const res = await DELETE(makeRequest(), { params: makeParams('guideline-1') });
        expect(res.status).toBe(404);
    });

    it('returns 200 on successful deletion', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.guideline.findUnique).mockResolvedValue(mockGuideline() as any);
        vi.mocked(prisma.guideline.delete).mockResolvedValue(mockGuideline() as any);

        const res = await DELETE(makeRequest(), { params: makeParams('guideline-1') });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('calls logAudit with GUIDELINE_DELETED including metadata.name and metadata.environments', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.guideline.findUnique).mockResolvedValue(mockGuideline() as any);
        vi.mocked(prisma.guideline.delete).mockResolvedValue(mockGuideline() as any);

        await DELETE(makeRequest(), { params: makeParams('guideline-1') });

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'GUIDELINE_DELETED',
                entityType: 'GUIDELINE',
                entityId: 'guideline-1',
                metadata: expect.objectContaining({ name: 'Test Guideline', environments: ['env1'] })
            })
        );
    });

    it('does not call logAudit when guideline is not found', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.guideline.findUnique).mockResolvedValue(null);

        await DELETE(makeRequest(), { params: makeParams('guideline-1') });
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });
});
