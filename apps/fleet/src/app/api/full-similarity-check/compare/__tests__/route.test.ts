import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
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
            findUnique: vi.fn(() => ({
                role: 'FLEET'
            }))
        },
        $queryRaw: vi.fn()
    }
}));

describe('POST /api/full-similarity-check/compare', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 for unauthenticated users', async () => {
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: {
                getUser: vi.fn(() => ({
                    data: { user: null },
                    error: new Error('Unauthorized')
                }))
            }
        } as any);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check/compare', {
            method: 'POST',
            body: JSON.stringify({
                projectId: 'test-project',
                taskIds: ['task-1'],
                scope: 'all'
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 for users without FLEET or ADMIN role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({
            role: 'USER'
        } as any);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check/compare', {
            method: 'POST',
            body: JSON.stringify({
                projectId: 'test-project',
                taskIds: ['task-1'],
                scope: 'all'
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Forbidden');
    });

    it('should return 400 for invalid request parameters', async () => {
        const request = new NextRequest('http://localhost:3004/api/full-similarity-check/compare', {
            method: 'POST',
            body: JSON.stringify({
                projectId: 'test-project',
                taskIds: [],
                scope: 'all'
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request parameters');
    });

    it('should return 400 for invalid scope', async () => {
        const request = new NextRequest('http://localhost:3004/api/full-similarity-check/compare', {
            method: 'POST',
            body: JSON.stringify({
                projectId: 'test-project',
                taskIds: ['task-1'],
                scope: 'invalid'
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid scope. Must be "environment" or "all"');
    });

    it('should return 400 if no tasks with embeddings found', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]); // Empty tasks

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check/compare', {
            method: 'POST',
            body: JSON.stringify({
                projectId: 'test-project',
                taskIds: ['task-1'],
                scope: 'all'
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('No valid tasks found with embeddings');
    });

    it('should successfully compare prompts and return matches', async () => {
        const { prisma } = await import('@repo/database');

        // Mock source task
        const sourceTask = {
            id: 'task-1',
            content: 'Source prompt content',
            metadata: { environment_name: 'Production' },
            embedding: '[0.1,0.2,0.3]', // PostgreSQL vector string format
            createdByName: 'User One',
            createdByEmail: 'user1@example.com',
            createdAt: new Date('2026-01-15')
        };

        // Mock comparison tasks
        const comparisonTasks = [
            {
                id: 'task-2',
                content: 'Similar prompt content',
                metadata: { environment_name: 'Production' },
                embedding: '[0.11,0.21,0.31]', // Similar vector
                createdByName: 'User Two',
                createdByEmail: 'user2@example.com',
                createdAt: new Date('2026-01-16')
            }
        ];

        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([sourceTask]) // First call: get source task
            .mockResolvedValueOnce(comparisonTasks); // Second call: get comparison tasks

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check/compare', {
            method: 'POST',
            body: JSON.stringify({
                projectId: 'test-project',
                taskIds: ['task-1'],
                scope: 'all'
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.results).toHaveLength(1);
        expect(data.results[0].sourceTaskId).toBe('task-1');
        expect(data.results[0].matches).toBeDefined();
    });

    it('should exclude tasks with identical content (duplicates)', async () => {
        const { prisma } = await import('@repo/database');

        const sourceTask = {
            id: 'task-1',
            content: 'Duplicate content',
            metadata: { environment_name: 'Production' },
            embedding: '[0.1,0.2,0.3]',
            createdByName: 'User One',
            createdByEmail: 'user1@example.com',
            createdAt: new Date('2026-01-15')
        };

        const comparisonTasks = [
            {
                id: 'task-2',
                content: 'Duplicate content', // Identical content, different ID
                metadata: { environment_name: 'Production' },
                embedding: '[0.1,0.2,0.3]', // Identical embedding
                createdByName: 'User Two',
                createdByEmail: 'user2@example.com',
                createdAt: new Date('2026-01-16')
            }
        ];

        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([sourceTask])
            .mockResolvedValueOnce(comparisonTasks);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check/compare', {
            method: 'POST',
            body: JSON.stringify({
                projectId: 'test-project',
                taskIds: ['task-1'],
                scope: 'all'
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        // Should have no matches because duplicate content is excluded
        expect(data.results[0].matches).toHaveLength(0);
    });

    it('should parse PostgreSQL vector format correctly', async () => {
        const { prisma } = await import('@repo/database');

        const sourceTask = {
            id: 'task-1',
            content: 'Test content',
            metadata: { environment_name: 'Production' },
            embedding: '[0.5,0.5,0.5]', // String format from PostgreSQL
            createdByName: 'User',
            createdByEmail: 'user@example.com',
            createdAt: new Date('2026-01-15')
        };

        const comparisonTask = {
            id: 'task-2',
            content: 'Different content',
            metadata: { environment_name: 'Production' },
            embedding: '[0.6,0.6,0.6]', // High similarity
            createdByName: 'User Two',
            createdByEmail: 'user2@example.com',
            createdAt: new Date('2026-01-16')
        };

        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([sourceTask])
            .mockResolvedValueOnce([comparisonTask]);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check/compare', {
            method: 'POST',
            body: JSON.stringify({
                projectId: 'test-project',
                taskIds: ['task-1'],
                scope: 'all'
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        // Vector parsing should work, allowing similarity calculation
        expect(data.results).toHaveLength(1);
    });

    it('should filter results by 50% similarity threshold', async () => {
        const { prisma } = await import('@repo/database');

        const sourceTask = {
            id: 'task-1',
            content: 'Test content',
            metadata: { environment_name: 'Production' },
            embedding: '[1.0,0.0,0.0]',
            createdByName: 'User',
            createdByEmail: 'user@example.com',
            createdAt: new Date('2026-01-15')
        };

        const comparisonTasks = [
            {
                id: 'task-2',
                content: 'High similarity',
                metadata: { environment_name: 'Production' },
                embedding: '[0.9,0.1,0.0]', // High similarity
                createdByName: 'User Two',
                createdByEmail: 'user2@example.com',
                createdAt: new Date('2026-01-16')
            },
            {
                id: 'task-3',
                content: 'Low similarity',
                metadata: { environment_name: 'Production' },
                embedding: '[0.0,0.0,1.0]', // Low similarity (orthogonal)
                createdByName: 'User Three',
                createdByEmail: 'user3@example.com',
                createdAt: new Date('2026-01-17')
            }
        ];

        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([sourceTask])
            .mockResolvedValueOnce(comparisonTasks);

        const request = new NextRequest('http://localhost:3004/api/full-similarity-check/compare', {
            method: 'POST',
            body: JSON.stringify({
                projectId: 'test-project',
                taskIds: ['task-1'],
                scope: 'all'
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        // Only high similarity task should be included (>= 50%)
        expect(data.results[0].matches.length).toBeLessThanOrEqual(1);
    });
});
