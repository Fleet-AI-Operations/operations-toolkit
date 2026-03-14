import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Must be set before importing the route
process.env.WEBHOOK_SECRET = 'test-secret';

vi.mock('@repo/database', () => ({
    prisma: {
        aIQualityJob: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        aIQualityRating: {
            findMany: vi.fn(() => Promise.resolve([])),
            createMany: vi.fn(() => Promise.resolve({ count: 0 })),
        },
        dataRecord: {
            findMany: vi.fn(() => Promise.resolve([])),
        },
    },
}));

vi.mock('@repo/core/ai', () => ({
    generateCompletionWithUsage: vi.fn(),
}));

import { POST } from '../route';
import { prisma } from '@repo/database';

const mockedPrisma = vi.mocked(prisma);

function makeRequest(body: unknown, secret = 'test-secret') {
    return new NextRequest('http://localhost/api/ai-quality-rating/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': secret,
        },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

describe('POST /api/ai-quality-rating/process — webhook auth', () => {
    it('returns 401 and logs an error when WEBHOOK_SECRET env var is not set', async () => {
        const original = process.env.WEBHOOK_SECRET;
        delete process.env.WEBHOOK_SECRET;
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const req = makeRequest({ jobId: 'j1' }, 'test-secret');
        const res = await POST(req);

        expect(res.status).toBe(401);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('WEBHOOK_SECRET is not set'));

        process.env.WEBHOOK_SECRET = original;
        errorSpy.mockRestore();
    });

    it('returns 401 when x-webhook-secret header is missing', async () => {
        const req = new NextRequest('http://localhost/api/ai-quality-rating/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: 'j1' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('returns 401 when webhook secret is wrong (same length)', async () => {
        const req = makeRequest({ jobId: 'j1' }, 'wrong-secre');

        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('returns 401 when webhook secret has different length (pre-check path)', async () => {
        const req = makeRequest({ jobId: 'j1' }, 'short');

        const res = await POST(req);
        expect(res.status).toBe(401);
    });
});

describe('POST /api/ai-quality-rating/process — request handling', () => {
    it('returns 400 when jobId is missing', async () => {
        const req = makeRequest({});

        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/jobId/i);
    });

    it('returns 404 when job does not exist', async () => {
        mockedPrisma.aIQualityJob.findUnique.mockResolvedValue(null);

        const req = makeRequest({ jobId: 'nonexistent' });
        const res = await POST(req);

        expect(res.status).toBe(404);
    });

    it('returns completed=true immediately when job is already in a terminal state', async () => {
        mockedPrisma.aIQualityJob.findUnique.mockResolvedValue({
            id: 'job-1',
            status: 'COMPLETED',
        } as any);

        const req = makeRequest({ jobId: 'job-1' });
        const res = await POST(req);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.completed).toBe(true);
        expect(body.status).toBe('COMPLETED');
        // Should not fire a recursive fetch for a terminal job
        expect(fetch).not.toHaveBeenCalled();
    });

    it('returns completed=true and does not recurse when no unrated records remain', async () => {
        mockedPrisma.aIQualityJob.findUnique.mockResolvedValue({
            id: 'job-done',
            status: 'PROCESSING',
            environment: 'test-env',
        } as any);
        mockedPrisma.aIQualityRating.findMany.mockResolvedValue([]);
        mockedPrisma.dataRecord.findMany.mockResolvedValue([]);

        const req = makeRequest({ jobId: 'job-done' });
        const res = await POST(req);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.completed).toBe(true);
        // Job should be marked COMPLETED
        expect(mockedPrisma.aIQualityJob.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'job-done' },
                data: expect.objectContaining({ status: 'COMPLETED' }),
            })
        );
    });
});
