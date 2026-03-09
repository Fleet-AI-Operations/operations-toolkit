import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@repo/database', () => ({
    prisma: {
        dataRecord: {
            findMany: vi.fn()
        },
        profile: {
            findMany: vi.fn()
        }
    }
}));

const makeAuthClient = (userId: string | null = 'test-user-id') => ({
    auth: {
        getUser: vi.fn().mockResolvedValue({
            data: { user: userId ? { id: userId } : null },
            error: null
        })
    }
});

const makeRecord = (overrides: Record<string, any> = {}) => ({
    id: 'record-1',
    content: 'Write a function that parses JSON',
    category: 'STANDARD',
    metadata: {},
    environment: 'production',
    createdById: 'user-uuid-1',
    createdByEmail: 'alice@example.com',
    createdByName: 'Alice Smith',
    createdAt: new Date('2026-01-12'),
    ...overrides,
});

const makeProfile = (overrides: Record<string, any> = {}) => ({
    id: 'user-uuid-1',
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.com',
    ...overrides,
});

describe('GET /api/analysis/prompts', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue(makeAuthClient() as any);
    });

    it('returns 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue(makeAuthClient(null) as any);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompts');
        const response = await GET(request);

        expect(response.status).toBe(401);
    });

    it('returns prompts with environment field', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([makeRecord()] as any);
        vi.mocked(prisma.profile.findMany).mockResolvedValue([makeProfile()] as any);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompts');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.prompts).toHaveLength(1);
        expect(data.prompts[0].environment).toBe('production');
    });

    it('filters by environment when provided', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([makeRecord()] as any);
        vi.mocked(prisma.profile.findMany).mockResolvedValue([makeProfile()] as any);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompts?environment=production');
        await GET(request);

        expect(vi.mocked(prisma.dataRecord.findMany)).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ environment: 'production' })
            })
        );
    });

    it('does not filter by environment when param is absent', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([makeRecord()] as any);
        vi.mocked(prisma.profile.findMany).mockResolvedValue([makeProfile()] as any);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompts');
        await GET(request);

        expect(vi.mocked(prisma.dataRecord.findMany)).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { type: 'TASK' }
            })
        );
    });

    it('returns users derived from prompts, sorted by last name', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
            makeRecord({ id: 'r1', createdById: 'uid-1' }),
            makeRecord({ id: 'r2', content: 'Different content', createdById: 'uid-2' }),
        ] as any);
        vi.mocked(prisma.profile.findMany).mockResolvedValue([
            makeProfile({ id: 'uid-1', firstName: 'Bob', lastName: 'Zane' }),
            makeProfile({ id: 'uid-2', firstName: 'Alice', lastName: 'Adams' }),
        ] as any);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompts');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.users).toHaveLength(2);
        // Sorted by last name: Adams before Zane
        expect(data.users[0].name).toBe('Alice Adams');
        expect(data.users[1].name).toBe('Bob Zane');
    });

    it('deduplicates prompts with identical content', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
            makeRecord({ id: 'r1', content: 'Same content' }),
            makeRecord({ id: 'r2', content: 'Same content' }), // duplicate
        ] as any);
        vi.mocked(prisma.profile.findMany).mockResolvedValue([makeProfile()] as any);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompts');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.prompts).toHaveLength(1);
        expect(data.prompts[0].id).toBe('r1'); // keeps most recent (first)
    });

    it('falls back to createdByName when profile is not found', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
            makeRecord({ createdById: 'unknown-uid', createdByName: 'External User' }),
        ] as any);
        vi.mocked(prisma.profile.findMany).mockResolvedValue([] as any);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompts');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.users[0].name).toBe('External User');
    });

    it('returns 500 on database error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findMany).mockRejectedValue(new Error('DB connection failed'));

        const request = new NextRequest('http://localhost:3002/api/analysis/prompts');
        const response = await GET(request);

        expect(response.status).toBe(500);
        expect((await response.json()).error).toContain('Failed to fetch prompts');
    });

    it('returns empty prompts and users when no records exist', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([] as any);
        vi.mocked(prisma.profile.findMany).mockResolvedValue([] as any);

        const request = new NextRequest('http://localhost:3002/api/analysis/prompts');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.prompts).toHaveLength(0);
        expect(data.users).toHaveLength(0);
    });
});
