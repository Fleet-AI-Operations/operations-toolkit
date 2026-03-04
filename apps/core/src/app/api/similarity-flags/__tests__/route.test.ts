import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock dependencies
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

// Shared flag row fixture
const makeFlagRow = (overrides = {}) => ({
    id: 'flag-1',
    similarity_job_id: 'job-1',
    source_record_id: 'src-record-1',
    matched_record_id: 'match-record-1',
    similarity_score: 0.87,
    user_email: 'worker@example.com',
    user_name: 'Worker One',
    environment: 'test-env',
    status: 'OPEN',
    claimed_by_email: null,
    claimed_at: null,
    notified_at: null,
    created_at: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
});

describe('GET /api/similarity-flags', () => {
    beforeEach(async () => {
        vi.clearAllMocks();

        // Restore default: authenticated CORE user
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

        const request = new NextRequest('http://localhost:3003/api/similarity-flags');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 for user with USER role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({
            role: 'USER'
        } as any);

        const request = new NextRequest('http://localhost:3003/api/similarity-flags');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Forbidden');
    });

    it('returns paginated flags for CORE role', async () => {
        const { prisma } = await import('@repo/database');
        const flagRow = makeFlagRow();

        // $queryRaw is called three times: flags, count, snippets
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([flagRow])                       // flags query
            .mockResolvedValueOnce([{ count: BigInt(1) }])          // count query
            .mockResolvedValueOnce([                                 // snippets query
                { id: 'src-record-1', content: 'Source prompt text snippet' },
                { id: 'match-record-1', content: 'Matched prompt text snippet' },
            ]);

        const request = new NextRequest('http://localhost:3003/api/similarity-flags');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.flags).toHaveLength(1);
        expect(data.total).toBe(1);
        expect(data.page).toBe(1);
        expect(data.limit).toBe(25);

        const flag = data.flags[0];
        expect(flag.id).toBe('flag-1');
        expect(flag.similarityJobId).toBe('job-1');
        expect(flag.sourceRecordId).toBe('src-record-1');
        expect(flag.matchedRecordId).toBe('match-record-1');
        expect(flag.similarityScore).toBe(0.87);
        expect(flag.userEmail).toBe('worker@example.com');
        expect(flag.userName).toBe('Worker One');
        expect(flag.environment).toBe('test-env');
        expect(flag.status).toBe('OPEN');
        expect(flag.claimedByEmail).toBeNull();
        expect(flag.claimedAt).toBeNull();
        expect(flag.notifiedAt).toBeNull();
        expect(flag.sourceSnippet).toBe('Source prompt text snippet');
        expect(flag.matchedSnippet).toBe('Matched prompt text snippet');
    });

    it('applies environment filter and returns flags', async () => {
        const { prisma } = await import('@repo/database');
        const flagRow = makeFlagRow({ environment: 'prod-env' });

        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([flagRow])
            .mockResolvedValueOnce([{ count: BigInt(1) }])
            .mockResolvedValueOnce([]);

        const request = new NextRequest(
            'http://localhost:3003/api/similarity-flags?environment=prod-env'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.flags).toHaveLength(1);
        expect(data.flags[0].environment).toBe('prod-env');
        // $queryRaw must have been called (at minimum: flags + count)
        expect(vi.mocked(prisma.$queryRaw)).toHaveBeenCalled();
    });

    it('applies status=OPEN filter and returns flags', async () => {
        const { prisma } = await import('@repo/database');
        const flagRow = makeFlagRow({ status: 'OPEN' });

        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([flagRow])
            .mockResolvedValueOnce([{ count: BigInt(1) }])
            .mockResolvedValueOnce([]);

        const request = new NextRequest(
            'http://localhost:3003/api/similarity-flags?status=OPEN'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.flags).toHaveLength(1);
        expect(data.flags[0].status).toBe('OPEN');
    });

    it('returns 200 with empty flags array when no results', async () => {
        const { prisma } = await import('@repo/database');

        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([])                       // flags query — empty
            .mockResolvedValueOnce([{ count: BigInt(0) }]);  // count query

        const request = new NextRequest('http://localhost:3003/api/similarity-flags');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.flags).toEqual([]);
        expect(data.total).toBe(0);
    });

    it('handles database error gracefully and returns 500', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('DB connection lost'));

        const request = new NextRequest('http://localhost:3003/api/similarity-flags');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Internal server error');
    });
});
