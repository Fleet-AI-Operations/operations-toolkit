import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Must be set before importing the route so the production guard is evaluated at import time
const originalNodeEnv = process.env.NODE_ENV;

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn(() => ({
                data: { user: { id: 'test-user-id' } },
                error: null
            }))
        }
    }))
}));

vi.mock('@repo/database', () => ({
    prisma: {
        profile: {
            findUnique: vi.fn(() => ({ role: 'FLEET' }))
        },
        ingestJob: {
            findMany: vi.fn(() => [])
        }
    }
}));

vi.mock('@repo/core/ingestion', () => ({
    runPhase1: vi.fn()
}));

describe('POST /api/ingest/dev-trigger-pending', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Ensure non-production for most tests
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    });

    afterEach(() => {
        Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, configurable: true });
    });

    it('returns 404 in production', async () => {
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
        // Re-import after env change so the guard re-evaluates
        vi.resetModules();
        const { POST } = await import('../route');

        const request = new NextRequest('http://localhost:3004/api/ingest/dev-trigger-pending', { method: 'POST' });
        const response = await POST(request);

        expect(response.status).toBe(404);
    });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: {
                getUser: vi.fn(() => ({
                    data: { user: null },
                    error: new Error('Unauthorized')
                }))
            }
        } as any);

        const { POST } = await import('../route');
        const request = new NextRequest('http://localhost:3004/api/ingest/dev-trigger-pending', { method: 'POST' });
        const response = await POST(request);

        expect(response.status).toBe(401);
    });

    it('returns 403 for USER role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'USER' } as any);

        const { POST } = await import('../route');
        const request = new NextRequest('http://localhost:3004/api/ingest/dev-trigger-pending', { method: 'POST' });
        const response = await POST(request);

        expect(response.status).toBe(403);
    });

    it('returns 200 with triggered=0 when no PENDING jobs exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.ingestJob.findMany).mockResolvedValue([]);

        const { POST } = await import('../route');
        const request = new NextRequest('http://localhost:3004/api/ingest/dev-trigger-pending', { method: 'POST' });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.triggered).toBe(0);
        expect(data.message).toContain('No PENDING jobs found');
    });

    it('triggers runPhase1 for each PENDING job and reports success', async () => {
        const { prisma } = await import('@repo/database');
        const { runPhase1 } = await import('@repo/core/ingestion');

        vi.mocked(prisma.ingestJob.findMany).mockResolvedValue([
            { id: 'job-1' } as any,
            { id: 'job-2' } as any,
        ]);
        vi.mocked(runPhase1).mockResolvedValue(undefined as any);

        const { POST } = await import('../route');
        const request = new NextRequest('http://localhost:3004/api/ingest/dev-trigger-pending', { method: 'POST' });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.triggered).toBe(2);
        expect(data.failed).toBe(0);
        expect(runPhase1).toHaveBeenCalledWith('job-1');
        expect(runPhase1).toHaveBeenCalledWith('job-2');
    });

    it('reports per-job errors without aborting remaining jobs', async () => {
        const { prisma } = await import('@repo/database');
        const { runPhase1 } = await import('@repo/core/ingestion');

        vi.mocked(prisma.ingestJob.findMany).mockResolvedValue([
            { id: 'job-ok' } as any,
            { id: 'job-fail' } as any,
        ]);
        vi.mocked(runPhase1)
            .mockResolvedValueOnce(undefined as any)
            .mockRejectedValueOnce(new Error('Phase1 failed'));

        const { POST } = await import('../route');
        const request = new NextRequest('http://localhost:3004/api/ingest/dev-trigger-pending', { method: 'POST' });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.triggered).toBe(1);
        expect(data.failed).toBe(1);
        expect(data.message).toContain('1 triggered');
        expect(data.message).toContain('1 failed');
        const failedResult = data.results.find((r: any) => r.status === 'error');
        expect(failedResult.error).toBe('Phase1 failed');
    });
});
