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
            findUnique: vi.fn(() => ({ role: 'CORE' }))
        },
        $queryRaw: vi.fn()
    }
}));

const makeTask = (overrides = {}) => ({
    id: 'task-1',
    content: 'Some task',
    environment: 'Production',
    createdByName: 'Bob',
    createdByEmail: 'bob@example.com',
    createdAt: new Date('2026-01-10'),
    taskKey: 'KEY-1',
    taskVersion: '1',
    ...overrides,
});

describe('GET /api/task-search', () => {
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

        const request = new NextRequest('http://localhost:3003/api/task-search?q=bob');
        const response = await GET(request);

        expect(response.status).toBe(401);
    });

    it('returns 403 for QA role (below CORE)', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'QA' } as any);

        const request = new NextRequest('http://localhost:3003/api/task-search?q=bob');
        const response = await GET(request);

        expect(response.status).toBe(403);
    });

    it('returns empty tasks array when query is blank', async () => {
        const request = new NextRequest('http://localhost:3003/api/task-search?q=');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tasks).toEqual([]);
    });

    it('returns tasks matching query (latestOnly=false)', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([makeTask(), makeTask({ id: 'task-2', taskVersion: '2' })]);

        const request = new NextRequest('http://localhost:3003/api/task-search?q=bob');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tasks).toHaveLength(2);
        expect(data.tasks[0].id).toBe('task-1');
    });

    it('returns deduplicated tasks when latestOnly=true', async () => {
        const { prisma } = await import('@repo/database');
        // Only latest version returned by DB (DISTINCT ON)
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([makeTask({ taskVersion: '3' })]);

        const request = new NextRequest('http://localhost:3003/api/task-search?q=bob&latestOnly=true');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tasks).toHaveLength(1);
        expect(data.tasks[0].taskVersion).toBe('3');
    });

    it('returns 500 on database failure', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('connection error'));

        const request = new NextRequest('http://localhost:3003/api/task-search?q=alice');
        const response = await GET(request);

        expect(response.status).toBe(500);
        expect((await response.json()).error).toBe('Search failed');
    });
});
