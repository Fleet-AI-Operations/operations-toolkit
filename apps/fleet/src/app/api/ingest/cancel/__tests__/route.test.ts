import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@repo/api-utils', () => ({ requireRole: vi.fn() }));

vi.mock('@repo/database', () => ({
    prisma: {
        ingestJob: {
            update: vi.fn()
        }
    }
}));

vi.mock('@repo/core/audit', () => ({ logAudit: vi.fn(() => Promise.resolve({ success: true })) }));

function makeAuthSuccess(id = 'user-1', role = 'FLEET') {
    return { user: { id, email: `${id}@example.com` }, role, error: null };
}

function makeAuthError(status: number) {
    return {
        user: null,
        role: null,
        error: Response.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
    };
}

const makeRequest = (body: object) =>
    new NextRequest('http://localhost:3004/api/ingest/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

describe('POST /api/ingest/cancel', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const { requireRole } = await import('@repo/api-utils');
        vi.mocked(requireRole).mockResolvedValue(makeAuthSuccess() as any);
    });

    it('returns 401 when unauthenticated', async () => {
        const { requireRole } = await import('@repo/api-utils');
        vi.mocked(requireRole).mockResolvedValue(makeAuthError(401) as any);

        const res = await POST(makeRequest({ jobId: 'job-1' }));
        expect(res.status).toBe(401);
    });

    it('returns 403 for insufficient role', async () => {
        const { requireRole } = await import('@repo/api-utils');
        vi.mocked(requireRole).mockResolvedValue(makeAuthError(403) as any);

        const res = await POST(makeRequest({ jobId: 'job-1' }));
        expect(res.status).toBe(403);
    });

    it('returns 400 when jobId is missing', async () => {
        const res = await POST(makeRequest({}));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('Job ID');
    });

    it('returns 200 with success and CANCELLED status on success', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.ingestJob.update).mockResolvedValue({ id: 'job-1', status: 'CANCELLED' } as any);

        const res = await POST(makeRequest({ jobId: 'job-1' }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.status).toBe('CANCELLED');
    });

    it('calls logAudit with DATA_INGESTION_CANCELLED on success', async () => {
        const { prisma } = await import('@repo/database');
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(prisma.ingestJob.update).mockResolvedValue({ id: 'job-1', status: 'CANCELLED' } as any);

        await POST(makeRequest({ jobId: 'job-1' }));

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'DATA_INGESTION_CANCELLED', entityType: 'INGEST_JOB', entityId: 'job-1' })
        );
    });

    it('returns 500 on database error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.ingestJob.update).mockRejectedValue(new Error('DB error'));

        const res = await POST(makeRequest({ jobId: 'job-1' }));
        expect(res.status).toBe(500);
    });
});
