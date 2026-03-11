import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        profile: {
            findUnique: vi.fn()
        }
    }
}));

vi.mock('@repo/core/ingestion', () => ({
    startBackgroundIngest: vi.fn(() => Promise.resolve({ jobId: 'job-1' }))
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

const makeRequest = (body: object) =>
    new NextRequest('http://localhost:3004/api/ingest/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

describe('POST /api/ingest/api', () => {
    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: null })) }
        } as any);

        const res = await POST(makeRequest({ url: 'https://example.com/data', environment: 'env1' }));
        expect(res.status).toBe(401);
    });

    it('returns 403 for CORE role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'CORE' } as any);

        const res = await POST(makeRequest({ url: 'https://example.com/data', environment: 'env1' }));
        expect(res.status).toBe(403);
    });

    it('returns 400 when url is missing', async () => {
        const res = await POST(makeRequest({ environment: 'env1' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('URL');
    });

    it('returns 400 when environment is missing', async () => {
        const res = await POST(makeRequest({ url: 'https://example.com/data' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('Environment');
    });

    it('returns 200 with jobId on success', async () => {
        const res = await POST(makeRequest({ url: 'https://example.com/data', environment: 'env1' }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.jobId).toBe('job-1');
    });

    it('calls logAudit with DATA_INGESTION_STARTED on success', async () => {
        const { logAudit } = await import('@repo/core/audit');

        await POST(makeRequest({ url: 'https://example.com/data', environment: 'env1' }));

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'DATA_INGESTION_STARTED',
                entityType: 'INGEST_JOB',
                entityId: 'job-1'
            })
        );
    });

    it('returns 500 on error', async () => {
        const { startBackgroundIngest } = await import('@repo/core/ingestion');
        vi.mocked(startBackgroundIngest).mockRejectedValue(new Error('Ingest failed'));

        const res = await POST(makeRequest({ url: 'https://example.com/data', environment: 'env1' }));
        expect(res.status).toBe(500);
    });
});
