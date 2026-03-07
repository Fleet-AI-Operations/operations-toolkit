import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        dataRecord: {
            findUnique: vi.fn()
        }
    }
}));

vi.mock('@repo/core/ai', () => ({
    generateCompletionWithUsage: vi.fn()
}));

vi.mock('@repo/core/audit', () => ({
    logAudit: vi.fn(() => Promise.resolve())
}));

const makeAuthClient = (user = { id: 'user-1', email: 'core@example.com' }, role = 'CORE') => ({
    auth: {
        getUser: vi.fn(() => ({
            data: { user },
            error: null
        }))
    },
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(() => ({ data: { role }, error: null }))
            }))
        }))
    }))
});

const makeBody = (overrides = {}) => ({
    sourceRecordId: 'src-1',
    matchedRecordId: 'match-1',
    ...overrides,
});

describe('POST /api/similarity-flags/ai-compare', () => {
    beforeEach(async () => {
        vi.clearAllMocks();

        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any);

        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findUnique)
            .mockResolvedValueOnce({ content: 'Source prompt text' } as any)
            .mockResolvedValueOnce({ content: 'Matched prompt text' } as any);

        const { generateCompletionWithUsage } = await import('@repo/core/ai');
        vi.mocked(generateCompletionWithUsage).mockResolvedValue({
            content: 'These prompts are very similar.',
            provider: 'openrouter',
            usage: { cost: 0.0012 },
        } as any);
    });

    it('returns 401 for unauthenticated request', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockResolvedValue({
            auth: {
                getUser: vi.fn(() => ({
                    data: { user: null },
                    error: new Error('Unauthorized')
                }))
            }
        } as any);

        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('returns 403 for USER role', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockResolvedValue(makeAuthClient(
            { id: 'user-1', email: 'user@example.com' },
            'USER'
        ) as any);

        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it('returns 400 when sourceRecordId is missing', async () => {
        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify({ matchedRecordId: 'match-1' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('sourceRecordId');
    });

    it('returns 400 when matchedRecordId is missing', async () => {
        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify({ sourceRecordId: 'src-1' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('matchedRecordId');
    });

    it('returns 400 for invalid JSON body', async () => {
        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: 'not-json',
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('returns 404 when source record is not found', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findUnique)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ content: 'Matched text' } as any);

        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toContain('Source record');
    });

    it('returns 404 when matched record is not found', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findUnique)
            .mockResolvedValueOnce({ content: 'Source text' } as any)
            .mockResolvedValueOnce(null);

        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toContain('Matched record');
    });

    it('returns 200 with analysis, cost, and provider on success', async () => {
        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.analysis).toBe('These prompts are very similar.');
        expect(data.provider).toBe('openrouter');
        expect(data.cost).toBe('$0.0012');
    });

    it('returns null cost when usage is absent', async () => {
        const { generateCompletionWithUsage } = await import('@repo/core/ai');
        vi.mocked(generateCompletionWithUsage).mockResolvedValue({
            content: 'Analysis result.',
            provider: 'lm-studio',
            usage: null,
        } as any);

        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.cost).toBeNull();
    });

    it('returns 502 when AI returns empty content', async () => {
        const { generateCompletionWithUsage } = await import('@repo/core/ai');
        vi.mocked(generateCompletionWithUsage).mockResolvedValue({
            content: '',
            provider: 'openrouter',
            usage: null,
        } as any);

        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(502);
        const data = await res.json();
        expect(data.error).toContain('empty response');
    });

    it('returns 502 when AI call throws', async () => {
        const { generateCompletionWithUsage } = await import('@repo/core/ai');
        vi.mocked(generateCompletionWithUsage).mockRejectedValue(new Error('AI timeout'));

        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(502);
    });

    it('returns 500 when DB fetch throws', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findUnique).mockRejectedValue(new Error('DB error'));

        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        expect(res.status).toBe(500);
    });

    it('does not expose raw DB error details to the client on failure', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findUnique).mockRejectedValue(
            new Error('PrismaClientKnownRequestError: table "data_records" does not exist')
        );

        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        const data = await res.json();
        expect(data.error).not.toContain('PrismaClientKnownRequestError');
        expect(data.error).not.toContain('data_records');
    });

    it('still returns 200 even when logAudit fails', async () => {
        const { logAudit } = await import('@repo/core/audit');
        vi.mocked(logAudit).mockRejectedValue(new Error('Audit DB unavailable'));

        const req = new NextRequest('http://localhost:3003/api/similarity-flags/ai-compare', {
            method: 'POST',
            body: JSON.stringify(makeBody()),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await POST(req);
        // Audit failure must not break the response
        expect(res.status).toBe(200);
    });
});
