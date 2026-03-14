import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Must be set before importing the route
process.env.WEBHOOK_SECRET = 'test-secret';

vi.mock('@repo/core/evaluation', () => ({
    processEvaluationBatch: vi.fn(),
}));

vi.mock('@repo/database', () => ({
    prisma: {
        lLMEvaluationJob: {
            update: vi.fn(),
        },
    },
}));

import { POST } from '../route';
import { processEvaluationBatch } from '@repo/core/evaluation';
import { prisma } from '@repo/database';

const mockedProcessBatch = vi.mocked(processEvaluationBatch);
const mockedPrisma = vi.mocked(prisma);

function makeRequest(body: unknown, secret = 'test-secret') {
    return new NextRequest('http://localhost/api/evaluation/bulk-llm/process', {
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
    mockedProcessBatch.mockResolvedValue({ completed: true });
});

describe('POST /api/evaluation/bulk-llm/process — webhook auth', () => {
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
        const req = new NextRequest('http://localhost/api/evaluation/bulk-llm/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: 'j1' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
        expect(mockedProcessBatch).not.toHaveBeenCalled();
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
        expect(mockedProcessBatch).not.toHaveBeenCalled();
    });

    it('returns 401 when webhook secret is longer than configured secret', async () => {
        const req = makeRequest({ jobId: 'j1' }, 'test-secret-but-longer');

        const res = await POST(req);
        expect(res.status).toBe(401);
    });
});

describe('POST /api/evaluation/bulk-llm/process — request handling', () => {
    it('returns 400 when jobId is missing', async () => {
        const req = makeRequest({});

        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/jobId/i);
    });

    it('returns 200 and does not recurse when batch is complete', async () => {
        mockedProcessBatch.mockResolvedValue({ completed: true });
        const req = makeRequest({ jobId: 'job-1' });

        const res = await POST(req);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.completed).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('fires recursive fetch with webhook secret when batch is not complete', async () => {
        mockedProcessBatch.mockResolvedValue({ completed: false });
        const req = makeRequest({ jobId: 'job-2' });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/evaluation/bulk-llm/process'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'x-webhook-secret': 'test-secret',
                }),
            })
        );
    });

    it('marks job FAILED and returns 500 when processEvaluationBatch throws', async () => {
        mockedProcessBatch.mockRejectedValue(new Error('DB connection lost'));
        const req = makeRequest({ jobId: 'job-err' });

        const res = await POST(req);

        expect(res.status).toBe(500);
        expect(mockedPrisma.lLMEvaluationJob.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'job-err' },
                data: expect.objectContaining({ status: 'FAILED' }),
            })
        );
        const body = await res.json();
        expect(body.error).toBe('Batch processing failed');
    });
});
