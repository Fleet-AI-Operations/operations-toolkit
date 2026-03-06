import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

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
            findUnique: vi.fn(() => ({ role: 'QA' }))
        },
        $queryRaw: vi.fn()
    }
}));

/** A target record returned by the first $queryRaw call. */
const makeTarget = (overrides: Record<string, any> = {}) => ({
    id: 'record-1',
    createdById: 'user-uuid',
    createdByName: 'Alice',
    createdByEmail: 'alice@example.com',
    has_embedding: true,
    ...overrides,
});

/** A similar prompt row returned by the second $queryRaw call. */
const makeSimilar = (overrides: Record<string, any> = {}) => ({
    id: 'record-2',
    content: 'Another prompt',
    category: 'STANDARD',
    metadata: {},
    createdAt: new Date('2026-01-12'),
    similarity: BigInt(75),
    ...overrides,
});

describe('GET /api/analysis/prompt-similarity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=r1');
        const response = await GET(request);

        expect(response.status).toBe(401);
    });

    it('returns 403 for USER role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'USER' } as any);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=r1');
        const response = await GET(request);

        expect(response.status).toBe(403);
    });

    it('returns 400 when recordId is missing', async () => {
        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity');
        const response = await GET(request);

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('Record ID is required');
    });

    it('returns 404 when target record does not exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]); // no rows found

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=missing');
        const response = await GET(request);

        expect(response.status).toBe(404);
        expect((await response.json()).error).toBe('Target prompt not found');
    });

    it('returns 404 when target record has no embedding', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([makeTarget({ has_embedding: false })]);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=r1');
        const response = await GET(request);

        expect(response.status).toBe(404);
        expect((await response.json()).error).toContain('does not have an embedding');
    });

    it('returns 422 when all user identity fields are null', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
            makeTarget({ createdById: null, createdByName: null, createdByEmail: null }),
        ]);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=r1');
        const response = await GET(request);

        expect(response.status).toBe(422);
        expect((await response.json()).error).toContain('No user identity');
    });

    it('filters by createdById when non-null', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([makeTarget({ createdById: 'user-uuid', createdByName: null, createdByEmail: null })])
            .mockResolvedValueOnce([makeSimilar()]);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=r1');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.similarPrompts).toHaveLength(1);
        expect(data.similarPrompts[0].similarity).toBe(75);
    });

    it('falls back to createdByName when createdById is null', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([makeTarget({ createdById: null, createdByName: 'Alice', createdByEmail: null })])
            .mockResolvedValueOnce([makeSimilar()]);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=r1');
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect((await response.json()).similarPrompts).toHaveLength(1);
    });

    it('falls back to createdByEmail when both createdById and createdByName are null', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([makeTarget({ createdById: null, createdByName: null, createdByEmail: 'alice@example.com' })])
            .mockResolvedValueOnce([makeSimilar()]);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=r1');
        const response = await GET(request);

        expect(response.status).toBe(200);
    });

    it('scopes query to environment when provided', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([makeTarget()])
            .mockResolvedValueOnce([makeSimilar()]);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=r1&environment=Production');
        const response = await GET(request);

        expect(response.status).toBe(200);
        // Two $queryRaw calls: target check + similarity search
        expect(vi.mocked(prisma.$queryRaw)).toHaveBeenCalledTimes(2);
    });

    it('returns empty similarPrompts when no matches found', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([makeTarget()])
            .mockResolvedValueOnce([]);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=r1');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.similarPrompts).toHaveLength(0);
    });

    it('returns 500 on database error during similarity query', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([makeTarget()])
            .mockRejectedValueOnce(new Error('pgvector error'));

        const request = new NextRequest('http://localhost:3002/api/analysis/prompt-similarity?recordId=r1');
        const response = await GET(request);

        expect(response.status).toBe(500);
    });
});
