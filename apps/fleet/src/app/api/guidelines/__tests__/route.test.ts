import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        profile: {
            findUnique: vi.fn()
        },
        guideline: {
            findMany: vi.fn(),
            create: vi.fn()
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

const mockGuideline = (overrides = {}) => ({
    id: 'guideline-1',
    name: 'Test Guideline',
    environments: ['env1'],
    uploadedBy: 'user-1',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    users: [{ email: 'user@example.com' }],
    ...overrides
});

describe('GET /api/guidelines', () => {
    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/guidelines'));
        expect(res.status).toBe(401);
        expect((await res.json()).error).toBe('Unauthorized');
    });

    it('returns 403 for users without sufficient role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'QA' } as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/guidelines'));
        expect(res.status).toBe(403);
    });

    it('returns 200 with guidelines list', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.guideline.findMany).mockResolvedValue([mockGuideline()] as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/guidelines'));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.guidelines).toHaveLength(1);
        expect(data.guidelines[0]).toMatchObject({ id: 'guideline-1', name: 'Test Guideline' });
    });

    it('filters by environment when provided', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.guideline.findMany).mockResolvedValue([mockGuideline()] as any);

        const res = await GET(new NextRequest('http://localhost:3004/api/guidelines?environment=env1'));
        expect(res.status).toBe(200);
        expect(vi.mocked(prisma.guideline.findMany)).toHaveBeenCalledWith(
            expect.objectContaining({ where: { environments: { has: 'env1' } } })
        );
    });

    it('returns 500 on database error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.guideline.findMany).mockRejectedValue(new Error('DB error'));

        const res = await GET(new NextRequest('http://localhost:3004/api/guidelines'));
        expect(res.status).toBe(500);
    });
});

describe('POST /api/guidelines', () => {
    const makeRequest = (body: object) =>
        new NextRequest('http://localhost:3004/api/guidelines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await POST(makeRequest({ name: 'G1', content: 'data:application/pdf;base64,abc' }));
        expect(res.status).toBe(401);
    });

    it('returns 403 for users without sufficient role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'CORE' } as any);

        const res = await POST(makeRequest({ name: 'G1', content: 'data:application/pdf;base64,abc' }));
        expect(res.status).toBe(403);
    });

    it('returns 400 when name is missing', async () => {
        const res = await POST(makeRequest({ content: 'data:application/pdf;base64,abc' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('Name');
    });

    it('returns 400 when content is missing', async () => {
        const res = await POST(makeRequest({ name: 'G1' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('PDF content');
    });

    it('returns 400 for invalid base64 format', async () => {
        const res = await POST(makeRequest({ name: 'G1', content: 'not-a-valid-base64-pdf' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('Invalid PDF format');
    });

    it('creates a guideline and returns 201', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.guideline.create).mockResolvedValue(mockGuideline() as any);

        const res = await POST(makeRequest({
            name: 'Test Guideline',
            content: 'data:application/pdf;base64,abc123',
            environments: ['env1']
        }));
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.guideline).toMatchObject({ id: 'guideline-1', name: 'Test Guideline' });
    });

    it('calls logAudit with GUIDELINE_CREATED on success', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.guideline.create).mockResolvedValue(mockGuideline() as any);

        await POST(makeRequest({
            name: 'Test Guideline',
            content: 'data:application/pdf;base64,abc123',
            environments: ['env1']
        }));

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'GUIDELINE_CREATED', entityType: 'GUIDELINE', entityId: 'guideline-1' })
        );
    });

    it('does not call logAudit when validation fails', async () => {
        const { logAudit } = await import('@repo/core/audit');
        await POST(makeRequest({ content: 'data:application/pdf;base64,abc' }));
        expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
    });
});
