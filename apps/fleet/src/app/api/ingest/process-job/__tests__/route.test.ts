import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Must be set before importing the route (read at module load time in some paths)
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

    it('returns 401 when webhook secret is wrong', async () => {
        const req = makeRequest({ job_id: 'j1', environment: 'prod', status: 'PENDING' }, 'wrong-secret');

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

    it('dispatches runPhase1 then runPhase2 via waitUntil for PENDING status', async () => {
        const req = makeRequest({ job_id: 'job-abc', environment: 'prod', status: 'PENDING' });

        const res = await POST(req);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.received).toBe(true);

        expect(mockedWaitUntil).toHaveBeenCalledTimes(1);
        // Trigger the promise passed to waitUntil so we can verify runPhase1/2 are called
        const promise = mockedWaitUntil.mock.calls[0][0] as Promise<void>;
        await promise;
        expect(mockedRunPhase1).toHaveBeenCalledWith('job-abc');
        expect(mockedRunPhase2).toHaveBeenCalledWith('job-abc', 'prod');
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

    it('responds immediately without waiting for processing to complete', async () => {
        let phase1Resolved = false;
        mockedRunPhase1.mockImplementationOnce(
            () => new Promise(resolve => setTimeout(() => { phase1Resolved = true; resolve(); }, 1000))
        );

        const req = makeRequest({ job_id: 'job-xyz', environment: 'prod', status: 'PENDING' });

        // Response should arrive before phase1Resolved becomes true
        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(phase1Resolved).toBe(false);
    });
});
