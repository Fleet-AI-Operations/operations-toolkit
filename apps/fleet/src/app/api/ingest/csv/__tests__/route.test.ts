import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@repo/api-utils', () => ({ requireRole: vi.fn() }));

vi.mock('@repo/core/ingestion', () => ({
    startBackgroundIngest: vi.fn(() => Promise.resolve({ jobId: 'job-1' }))
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

const makeFile = (name: string, content: string, size = content.length) => ({
    name,
    size,
    text: vi.fn(() => Promise.resolve(content)),
    type: 'text/csv'
});

function makeRequestWithFile(file: ReturnType<typeof makeFile> | null) {
    const req = new NextRequest('http://localhost:3004/api/ingest/csv', {
        method: 'POST',
    });
    vi.spyOn(req, 'formData').mockResolvedValue({
        get: vi.fn((key: string) => key === 'file' ? file : null)
    } as any);
    return req;
}

describe('POST /api/ingest/csv', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const { requireRole } = await import('@repo/api-utils');
        vi.mocked(requireRole).mockResolvedValue(makeAuthSuccess() as any);
    });

    it('returns 401 when unauthenticated', async () => {
        const { requireRole } = await import('@repo/api-utils');
        vi.mocked(requireRole).mockResolvedValue(makeAuthError(401) as any);

        const res = await POST(makeRequestWithFile(makeFile('data.csv', 'col1,col2\nval1,val2')));
        expect(res.status).toBe(401);
    });

    it('returns 403 for insufficient role', async () => {
        const { requireRole } = await import('@repo/api-utils');
        vi.mocked(requireRole).mockResolvedValue(makeAuthError(403) as any);

        const res = await POST(makeRequestWithFile(makeFile('data.csv', 'col1,col2\nval1,val2')));
        expect(res.status).toBe(403);
    });

    it('returns 400 when no file is provided', async () => {
        const res = await POST(makeRequestWithFile(null));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('File is required');
    });

    it('returns 400 when file is not a csv', async () => {
        const res = await POST(makeRequestWithFile(makeFile('data.txt', 'some content')));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('CSV');
    });

    it('returns 413 when file is too large', async () => {
        const MAX_SIZE = 150 * 1024 * 1024;
        const largeFile = makeFile('data.csv', 'col1,col2', MAX_SIZE + 1);
        const res = await POST(makeRequestWithFile(largeFile));
        expect(res.status).toBe(413);
    });

    it('returns 400 when CSV content is empty', async () => {
        const res = await POST(makeRequestWithFile(makeFile('data.csv', '   ')));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('empty');
    });

    it('returns 200 with message and jobId on success', async () => {
        const res = await POST(makeRequestWithFile(makeFile('data.csv', 'col1,col2\nval1,val2')));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.message).toBeTruthy();
        expect(data.jobId).toBe('job-1');
    });

    it('calls logAudit with DATA_INGESTION_STARTED on success', async () => {
        const { logAudit } = await import('@repo/core/audit');

        await POST(makeRequestWithFile(makeFile('data.csv', 'col1,col2\nval1,val2')));

        expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'DATA_INGESTION_STARTED',
                entityType: 'INGEST_JOB',
                entityId: 'job-1',
                metadata: expect.objectContaining({
                    source: expect.stringContaining('csv:'),
                    generateEmbeddings: false
                })
            })
        );
    });
});
