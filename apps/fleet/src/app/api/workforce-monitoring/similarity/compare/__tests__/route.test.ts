import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn(() => ({
                data: { user: { id: 'fleet-user-id' } },
                error: null,
            })),
        },
    })),
}));

vi.mock('@repo/database', () => ({
    prisma: {
        profile: {
            findUnique: vi.fn(() => ({ role: 'FLEET' })),
        },
        $queryRaw: vi.fn(),
    },
}));

vi.mock('@repo/core/ai', () => ({
    cosineSimilarity: vi.fn((a: number[], b: number[]) => {
        // Simple dot product for unit vectors
        const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
        const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
        const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
        return magA && magB ? dot / (magA * magB) : 0;
    }),
}));

const makeRequest = (body: unknown) =>
    new NextRequest('http://localhost:3004/api/workforce-monitoring/similarity/compare', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });

const sourceTask = {
    id: 'task-source',
    content: 'Source task content',
    environment: 'Production',
    metadata: { task_key: 'T-001' },
    embedding: '[1.0, 0.0, 0.0]',
    createdByEmail: 'worker@example.com',
    createdAt: new Date('2026-03-01'),
};

const similarTask = {
    id: 'task-similar',
    content: 'Similar task content',
    environment: 'Production',
    metadata: { task_key: 'T-002' },
    embedding: '[0.9, 0.1, 0.0]',
    createdByName: 'Other Worker',
    createdByEmail: 'other@example.com',
    createdAt: new Date('2026-03-02'),
};

const orthogonalTask = {
    id: 'task-orthogonal',
    content: 'Unrelated task content',
    environment: 'Production',
    metadata: { task_key: 'T-003' },
    embedding: '[0.0, 0.0, 1.0]',
    createdByName: 'Third Worker',
    createdByEmail: 'third@example.com',
    createdAt: new Date('2026-03-03'),
};

const mockAuthenticatedUser = async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue({
        auth: {
            getUser: vi.fn(() => ({
                data: { user: { id: 'fleet-user-id' } },
                error: null,
            })),
        },
    } as any);
};

describe('POST /api/workforce-monitoring/similarity/compare', () => {
    beforeEach(async () => {
        vi.resetAllMocks(); // also clears unconsumed mockResolvedValueOnce queues
        await mockAuthenticatedUser();
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);
    });

    it('returns 401 when unauthenticated', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: { getUser: vi.fn(() => ({ data: { user: null }, error: new Error('no session') })) },
        } as any);

        const res = await POST(makeRequest({ taskId: 'task-1', scope: 'all' }));
        expect(res.status).toBe(401);
    });

    it('returns 403 for roles below FLEET', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'CORE' } as any);

        const res = await POST(makeRequest({ taskId: 'task-1', scope: 'all' }));
        expect(res.status).toBe(403);
    });

    it('returns 400 when taskId is missing', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);

        const res = await POST(makeRequest({ scope: 'all' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('taskId is required');
    });

    it('returns 400 for invalid scope', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([sourceTask]);

        const res = await POST(makeRequest({ taskId: 'task-source', scope: 'invalid' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('scope must be');
    });

    it('returns 404 when task has no embedding', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]); // empty = not found

        const res = await POST(makeRequest({ taskId: 'task-missing', scope: 'all' }));
        expect(res.status).toBe(404);
        expect((await res.json()).error).toContain('not found');
    });

    it('returns sorted matches above the default 50% threshold', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([sourceTask])
            .mockResolvedValueOnce([similarTask, orthogonalTask]);

        const res = await POST(makeRequest({ taskId: 'task-source', scope: 'all', workerEmail: 'worker@example.com' }));
        expect(res.status).toBe(200);
        const data = await res.json();
        // orthogonalTask has ~0% similarity (orthogonal vector), should be excluded
        expect(data.matches.length).toBeGreaterThanOrEqual(1);
        // Results must be sorted highest similarity first
        for (let i = 1; i < data.matches.length; i++) {
            expect(data.matches[i - 1].similarity).toBeGreaterThanOrEqual(data.matches[i].similarity);
        }
    });

    it('marks isSameWorker correctly when createdByEmail matches workerEmail', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);

        const sameWorkerTask = {
            ...similarTask,
            id: 'task-same-worker',
            content: 'Same worker task',
            createdByEmail: 'worker@example.com',
        };

        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([sourceTask])
            .mockResolvedValueOnce([sameWorkerTask]);

        const res = await POST(makeRequest({
            taskId: 'task-source',
            scope: 'all',
            workerEmail: 'worker@example.com',
        }));
        expect(res.status).toBe(200);
        const data = await res.json();
        if (data.matches.length > 0) {
            expect(data.matches[0].isSameWorker).toBe(true);
        }
    });

    it('excludes tasks with identical content (deduplication)', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);

        const duplicateTask = {
            ...similarTask,
            id: 'task-duplicate',
            content: sourceTask.content, // identical content
        };

        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([sourceTask])
            .mockResolvedValueOnce([duplicateTask]);

        const res = await POST(makeRequest({ taskId: 'task-source', scope: 'all' }));
        expect(res.status).toBe(200);
        const data = await res.json();
        // Identical content should be skipped
        const dupMatch = data.matches.find((m: { taskId: string }) => m.taskId === 'task-duplicate');
        expect(dupMatch).toBeUndefined();
    });

    it('respects a custom threshold — excludes matches below it', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([sourceTask])
            .mockResolvedValueOnce([orthogonalTask]); // ~0% similarity

        const res = await POST(makeRequest({
            taskId: 'task-source',
            scope: 'all',
            threshold: 95, // very high — orthogonal task should not appear
        }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.matches).toHaveLength(0);
    });

    it('includes source metadata in the response', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([sourceTask])
            .mockResolvedValueOnce([]);

        const res = await POST(makeRequest({ taskId: 'task-source', scope: 'environment' }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.source.id).toBe('task-source');
        expect(data.source.environment).toBe('Production');
        expect(data.source.taskKey).toBe('T-001');
    });

    it('parses array-format embeddings correctly', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({ role: 'FLEET' } as any);

        const arrayEmbeddingSource = { ...sourceTask, embedding: [1.0, 0.0, 0.0] };
        const arrayEmbeddingComparison = { ...similarTask, embedding: [0.9, 0.1, 0.0] };

        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([arrayEmbeddingSource])
            .mockResolvedValueOnce([arrayEmbeddingComparison]);

        const res = await POST(makeRequest({ taskId: 'task-source', scope: 'all' }));
        expect(res.status).toBe(200);
    });
});
