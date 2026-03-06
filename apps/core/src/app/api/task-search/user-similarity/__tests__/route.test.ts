import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

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
            findUnique: vi.fn(() => ({ role: 'CORE' }))
        },
        $queryRaw: vi.fn()
    }
}));

const makeSource = (overrides = {}) => ({
    id: 'record-1',
    createdByEmail: 'alice@example.com',
    createdById: null,
    environment: 'Production',
    has_embedding: true,
    ...overrides,
});

const makeMatch = (overrides = {}) => ({
    id: 'record-2',
    content: 'Another task',
    environment: 'Production',
    createdByName: 'Alice',
    createdByEmail: 'alice@example.com',
    createdAt: new Date('2026-01-12'),
    taskKey: 'KEY-2',
    taskVersion: '1',
    similarity: BigInt(78),
    ...overrides,
});

const makeRequest = (body: Record<string, any>) =>
    new NextRequest('http://localhost:3003/api/task-search/user-similarity', {
        method: 'POST',
        body: JSON.stringify(body),
    });

describe('POST /api/task-search/user-similarity', () => {
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

        const response = await POST(makeRequest({ recordId: 'r1' }));

        expect(response.status).toBe(401);
    });

    it('returns 403 for insufficient role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'QA' } as any);

        const response = await POST(makeRequest({ recordId: 'r1' }));

        expect(response.status).toBe(403);
    });

    it('returns 400 when request body is invalid JSON', async () => {
        const request = new NextRequest('http://localhost:3003/api/task-search/user-similarity', {
            method: 'POST',
            body: 'not-json',
        });
        const response = await POST(request);

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('Invalid request body');
    });

    it('returns 400 when recordId is missing from body', async () => {
        const response = await POST(makeRequest({}));

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('recordId is required');
    });

    it('returns 404 when source record is not found', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]); // no rows

        const response = await POST(makeRequest({ recordId: 'missing' }));

        expect(response.status).toBe(404);
    });

    it('returns 422 when source record has no embedding', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([makeSource({ has_embedding: false })]);

        const response = await POST(makeRequest({ recordId: 'r1' }));

        expect(response.status).toBe(422);
        expect((await response.json()).error).toContain('no embedding');
    });

    it('returns 422 when source record has no environment', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([makeSource({ environment: '' })]);

        const response = await POST(makeRequest({ recordId: 'r1' }));

        expect(response.status).toBe(422);
        expect((await response.json()).error).toContain('no environment');
    });

    it('returns 422 when source record has no user identity', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
            makeSource({ createdByEmail: null, createdById: null }),
        ]);

        const response = await POST(makeRequest({ recordId: 'r1' }));

        expect(response.status).toBe(422);
        expect((await response.json()).error).toContain('No user identity');
    });

    it('returns matches with versionFiltered=true when user has v1 tasks (latestOnly=false)', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([makeSource()])                  // source record
            .mockResolvedValueOnce([{ v1_count: BigInt(3) }])      // v1 count check
            .mockResolvedValueOnce([makeMatch()]);                  // similarity results

        const response = await POST(makeRequest({ recordId: 'r1', latestOnly: false }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.versionFiltered).toBe(true);
        expect(data.matches).toHaveLength(1);
        expect(data.matches[0].similarity).toBe(78);
    });

    it('returns matches with versionFiltered=false when user has no v1 tasks (latestOnly=false)', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([makeSource()])
            .mockResolvedValueOnce([{ v1_count: BigInt(0) }])
            .mockResolvedValueOnce([makeMatch()]);

        const response = await POST(makeRequest({ recordId: 'r1', latestOnly: false }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.versionFiltered).toBe(false);
    });

    it('returns matches with versionFiltered=true when latestOnly=true', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([makeSource()])
            .mockResolvedValueOnce([makeMatch({ taskVersion: '3' })]);

        const response = await POST(makeRequest({ recordId: 'r1', latestOnly: true }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.versionFiltered).toBe(true);
        expect(data.matches).toHaveLength(1);
    });

    it('returns 500 on similarity query DB error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([makeSource()])
            .mockRejectedValueOnce(new Error('pgvector failure'));

        const response = await POST(makeRequest({ recordId: 'r1', latestOnly: true }));

        expect(response.status).toBe(500);
    });
});
