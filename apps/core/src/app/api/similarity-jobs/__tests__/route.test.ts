import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        profile: {
            findUnique: vi.fn()
        },
        $queryRaw: vi.fn()
    }
}));

const makeJobRow = (overrides = {}) => ({
    id: 'sim-job-1',
    ingest_job_id: 'ingest-abc',
    environment: 'test-env',
    status: 'COMPLETED',
    records_checked: BigInt(10),
    flags_found: BigInt(3),
    error: null,
    created_at: new Date('2026-01-15T10:00:00Z'),
    updated_at: new Date('2026-01-15T10:01:00Z'),
    ...overrides,
});

describe('GET /api/similarity-jobs', () => {
    beforeEach(async () => {
        vi.clearAllMocks();

        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: {
                getUser: vi.fn(() => ({
                    data: { user: { id: 'test-user-id', email: 'core@example.com' } },
                    error: null
                }))
            }
        } as any);

        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({
            role: 'CORE'
        } as any);
    });

    it('returns 401 for unauthenticated user', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: {
                getUser: vi.fn(() => ({
                    data: { user: null },
                    error: new Error('Unauthorized')
                }))
            }
        } as any);

        const request = new NextRequest('http://localhost:3003/api/similarity-jobs');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 for USER role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'USER' } as any);

        const request = new NextRequest('http://localhost:3003/api/similarity-jobs');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Forbidden');
    });

    it('returns jobs with numeric fields coerced from BigInt', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([makeJobRow()]);

        const request = new NextRequest('http://localhost:3003/api/similarity-jobs');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.jobs).toHaveLength(1);

        const job = data.jobs[0];
        expect(job.id).toBe('sim-job-1');
        expect(job.ingestJobId).toBe('ingest-abc');
        expect(job.environment).toBe('test-env');
        expect(job.status).toBe('COMPLETED');
        // BigInt coercion: records_checked and flags_found must be plain numbers
        expect(typeof job.recordsChecked).toBe('number');
        expect(job.recordsChecked).toBe(10);
        expect(typeof job.flagsFound).toBe('number');
        expect(job.flagsFound).toBe(3);
        expect(job.error).toBeNull();
    });

    it('applies environment filter', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
            makeJobRow({ environment: 'prod-env' })
        ]);

        const request = new NextRequest(
            'http://localhost:3003/api/similarity-jobs?environment=prod-env'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.jobs[0].environment).toBe('prod-env');
        expect(vi.mocked(prisma.$queryRaw)).toHaveBeenCalledTimes(1);
    });

    it('returns empty jobs array when no results', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);

        const request = new NextRequest('http://localhost:3003/api/similarity-jobs');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.jobs).toEqual([]);
    });

    it('handles database error and returns 500', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('DB error'));

        const request = new NextRequest('http://localhost:3003/api/similarity-jobs');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Internal server error');
    });
});
