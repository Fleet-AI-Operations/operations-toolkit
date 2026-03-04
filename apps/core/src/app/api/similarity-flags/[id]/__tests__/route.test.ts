import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '../route';

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

describe('PATCH /api/similarity-flags/[id]', () => {
    beforeEach(async () => {
        vi.clearAllMocks();

        // Restore default: authenticated CORE user with email
        const { createClient } = await import('@repo/auth/server');
        vi.mocked(createClient).mockReturnValue({
            auth: {
                getUser: vi.fn(() => ({
                    data: { user: { id: 'test-user-id', email: 'claimer@example.com' } },
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

        const request = new NextRequest('http://localhost:3003/api/similarity-flags/test-flag-id', {
            method: 'PATCH',
            body: JSON.stringify({ action: 'claim' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const params = Promise.resolve({ id: 'test-flag-id' });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 for user with wrong role', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.profile.findUnique).mockResolvedValue({
            role: 'USER'
        } as any);

        const request = new NextRequest('http://localhost:3003/api/similarity-flags/test-flag-id', {
            method: 'PATCH',
            body: JSON.stringify({ action: 'claim' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const params = Promise.resolve({ id: 'test-flag-id' });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Forbidden');
    });

    it('returns 400 for invalid action', async () => {
        const request = new NextRequest('http://localhost:3003/api/similarity-flags/test-flag-id', {
            method: 'PATCH',
            body: JSON.stringify({ action: 'delete' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const params = Promise.resolve({ id: 'test-flag-id' });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid action');
    });

    it('successfully claims a flag and returns 200 with CLAIMED status', async () => {
        const { prisma } = await import('@repo/database');
        const claimedAt = new Date('2026-03-04T12:00:00Z');

        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
            {
                id: 'test-flag-id',
                status: 'CLAIMED',
                claimed_by_email: 'claimer@example.com',
                claimed_at: claimedAt,
            }
        ]);

        const request = new NextRequest('http://localhost:3003/api/similarity-flags/test-flag-id', {
            method: 'PATCH',
            body: JSON.stringify({ action: 'claim' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const params = Promise.resolve({ id: 'test-flag-id' });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.id).toBe('test-flag-id');
        expect(data.status).toBe('CLAIMED');
        expect(data.claimedByEmail).toBe('claimer@example.com');
        expect(data.claimedAt).toBe(claimedAt.toISOString());
    });

    it('returns 409 when flag is not found or already claimed', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);

        const request = new NextRequest('http://localhost:3003/api/similarity-flags/test-flag-id', {
            method: 'PATCH',
            body: JSON.stringify({ action: 'claim' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const params = Promise.resolve({ id: 'test-flag-id' });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe('Flag not found or already claimed');
    });
});
