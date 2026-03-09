import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Must be set before importing the route — the module throws at load time if missing.
process.env.WEBHOOK_SECRET = 'test-secret';

vi.mock('@vercel/functions', () => ({
    waitUntil: vi.fn(),
}));

vi.mock('@repo/core/ingestion', () => ({
    runPhase1: vi.fn(() => Promise.resolve()),
    runPhase2: vi.fn(() => Promise.resolve()),
}));

import { POST } from '../route';
import { waitUntil } from '@vercel/functions';
import { runPhase1, runPhase2 } from '@repo/core/ingestion';

const mockedWaitUntil = vi.mocked(waitUntil);
const mockedRunPhase1 = vi.mocked(runPhase1);
const mockedRunPhase2 = vi.mocked(runPhase2);

function makeRequest(body: unknown, secret = 'test-secret') {
    return new NextRequest('http://localhost/api/ingest/process-job', {
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
});

describe('POST /api/ingest/process-job', () => {
    it('returns 500 when WEBHOOK_SECRET env var is not set', async () => {
        const original = process.env.WEBHOOK_SECRET;
        delete process.env.WEBHOOK_SECRET;

        const req = makeRequest({ job_id: 'j1', environment: 'prod', status: 'PENDING' }, 'any-value');
        const res = await POST(req);
        expect(res.status).toBe(500);

        process.env.WEBHOOK_SECRET = original;
    });

    it('returns 401 when webhook secret is missing', async () => {
        const req = new NextRequest('http://localhost/api/ingest/process-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id: 'j1', environment: 'prod', status: 'PENDING' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
        expect(mockedWaitUntil).not.toHaveBeenCalled();
    });

    it('returns 401 when webhook secret is wrong (same length)', async () => {
        // Same byte-length as 'test-secret' — timingSafeEqual does the comparison, no throw
        const req = makeRequest({ job_id: 'j1', environment: 'prod', status: 'PENDING' }, 'wrong-secre');

        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('returns 401 when webhook secret has different length (timingSafeEqual catch path)', async () => {
        // Buffer.byteLength differs → timingSafeEqual throws RangeError → catch sets authorized=false
        const req = makeRequest({ job_id: 'j1', environment: 'prod', status: 'PENDING' }, 'short');

        const res = await POST(req);
        expect(res.status).toBe(401);
        expect(mockedWaitUntil).not.toHaveBeenCalled();
    });

    it('returns 401 when webhook secret is a longer string', async () => {
        // Longer than 'test-secret' — also hits the length-mismatch catch path
        const req = makeRequest({ job_id: 'j1', environment: 'prod', status: 'PENDING' }, 'test-secret-but-longer');

        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('returns 400 when body is not valid JSON', async () => {
        const req = new NextRequest('http://localhost/api/ingest/process-job', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': 'test-secret',
            },
            body: 'not-json{{{',
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/invalid json/i);
    });

    it('returns 400 when job_id is missing', async () => {
        const req = makeRequest({ environment: 'prod', status: 'PENDING' });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('returns 400 when environment is missing', async () => {
        const req = makeRequest({ job_id: 'j1', status: 'PENDING' });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('returns 400 when status is missing', async () => {
        const req = makeRequest({ job_id: 'j1', environment: 'prod' });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('dispatches only runPhase1 via waitUntil for PENDING status', async () => {
        const req = makeRequest({ job_id: 'job-abc', environment: 'prod', status: 'PENDING' });

        const res = await POST(req);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.received).toBe(true);

        expect(mockedWaitUntil).toHaveBeenCalledTimes(1);
        const promise = mockedWaitUntil.mock.calls[0][0] as Promise<void>;
        await promise;
        expect(mockedRunPhase1).toHaveBeenCalledWith('job-abc');
        // Phase 2 is triggered by a separate DB trigger on QUEUED_FOR_VEC update,
        // not chained here — each phase gets its own 300s Vercel window.
        expect(mockedRunPhase2).not.toHaveBeenCalled();
    });

    it('dispatches only runPhase2 via waitUntil for QUEUED_FOR_VEC status', async () => {
        const req = makeRequest({ job_id: 'job-def', environment: 'staging', status: 'QUEUED_FOR_VEC' });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(mockedWaitUntil).toHaveBeenCalledTimes(1);

        const promise = mockedWaitUntil.mock.calls[0][0] as Promise<void>;
        await promise;
        expect(mockedRunPhase1).not.toHaveBeenCalled();
        expect(mockedRunPhase2).toHaveBeenCalledWith('job-def', 'staging');
    });

    it('takes no action and returns 200 for an unexpected status', async () => {
        const req = makeRequest({ job_id: 'job-ghi', environment: 'prod', status: 'CANCELLED' });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(mockedWaitUntil).not.toHaveBeenCalled();
    });

    it('logs Phase 1 errors without throwing — response is still 200', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockedRunPhase1.mockRejectedValueOnce(new Error('AI timeout'));

        const req = makeRequest({ job_id: 'job-err', environment: 'prod', status: 'PENDING' });
        const res = await POST(req);

        expect(res.status).toBe(200);

        const promise = mockedWaitUntil.mock.calls[0][0] as Promise<void>;
        await promise;

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Phase 1 failed'),
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });

    it('logs Phase 2 errors without throwing — response is still 200', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockedRunPhase2.mockRejectedValueOnce(new Error('Embedding service down'));

        const req = makeRequest({ job_id: 'job-err2', environment: 'prod', status: 'QUEUED_FOR_VEC' });
        const res = await POST(req);

        expect(res.status).toBe(200);

        const promise = mockedWaitUntil.mock.calls[0][0] as Promise<void>;
        await promise;

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Phase 2 failed'),
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });

    it('responds immediately without waiting for processing to complete', async () => {
        let phase1Resolved = false;
        mockedRunPhase1.mockImplementationOnce(
            () => new Promise(resolve => setTimeout(() => { phase1Resolved = true; resolve(); }, 1000))
        );

        const req = makeRequest({ job_id: 'job-xyz', environment: 'prod', status: 'PENDING' });

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(phase1Resolved).toBe(false);
    });
});
