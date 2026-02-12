import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

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
        dataRecord: {
            findMany: vi.fn(() => ([
                {
                    id: 'task-1',
                    content: 'Test task content',
                    metadata: { environment_name: 'Production' },
                    createdByName: 'Test User',
                    createdByEmail: 'test@example.com',
                    createdAt: new Date('2026-01-15')
                }
            ]))
        }
    }
}));

describe('GET /api/full-similarity-check', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 for unauthenticated users', async () => {
        // Mock unauthorized user
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: {
                getUser: vi.fn(() => ({
                    data: { user: null },
                    error: new Error('Unauthorized')
                }))
            }
        } as any);

        const url = new URL('http://localhost:3004/api/full-similarity-check?projectId=test-project');
        const request = new NextRequest(url);

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 for users without FLEET or ADMIN role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({
            role: 'USER'
        } as any);

        const url = new URL('http://localhost:3004/api/full-similarity-check?projectId=test-project');
        const request = new NextRequest(url);

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Forbidden');
    });

    it('should return 400 if projectId is missing', async () => {
        const url = new URL('http://localhost:3004/api/full-similarity-check');
        const request = new NextRequest(url);

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('projectId is required');
    });

    it('should return tasks with embeddings for valid request', async () => {
        const { prisma } = await import('@repo/database');
        const mockTasks = [
            {
                id: 'task-1',
                content: 'Test task 1',
                metadata: { environment_name: 'Production' },
                createdByName: 'User One',
                createdByEmail: 'user1@example.com',
                createdAt: new Date('2026-01-15')
            },
            {
                id: 'task-2',
                content: 'Test task 2',
                metadata: { environment_name: 'Staging' },
                createdByName: 'User Two',
                createdByEmail: 'user2@example.com',
                createdAt: new Date('2026-01-16')
            }
        ];
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue(mockTasks as any);

        const url = new URL('http://localhost:3004/api/full-similarity-check?projectId=test-project');
        const request = new NextRequest(url);

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tasks).toHaveLength(2);
        expect(data.tasks[0]).toMatchObject({
            id: 'task-1',
            content: 'Test task 1',
            environment: 'Production',
            createdBy: 'User One'
        });
    });

    it('should handle tasks with missing metadata gracefully', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
            {
                id: 'task-1',
                content: 'Test task',
                metadata: null,
                createdByName: null,
                createdByEmail: 'user@example.com',
                createdAt: new Date('2026-01-15')
            }
        ] as any);

        const url = new URL('http://localhost:3004/api/full-similarity-check?projectId=test-project');
        const request = new NextRequest(url);

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tasks[0].environment).toBe('N/A');
        expect(data.tasks[0].createdBy).toBe('user@example.com');
    });
});
