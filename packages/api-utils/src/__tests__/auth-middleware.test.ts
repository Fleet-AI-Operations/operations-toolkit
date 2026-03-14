import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@repo/auth/server', () => ({
    createClient: vi.fn(),
}));

vi.mock('@repo/auth/utils', () => ({
    getUserRole: vi.fn(),
    authenticateWithToken: vi.fn(() => null),
}));

import { requireMinRole } from '../auth-middleware';
import { createClient } from '@repo/auth/server';
import { getUserRole } from '@repo/auth/utils';

const mockedGetUserRole = vi.mocked(getUserRole);
const mockedCreateClient = vi.mocked(createClient);

function makeRequest(options: { userId?: string; email?: string } = {}) {
    const { userId = 'user-1', email = 'user@example.com' } = options;
    mockedCreateClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: userId, email } },
                error: null,
            }),
        },
    } as any);
    return new NextRequest('http://localhost/api/test', { method: 'GET' });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('requireMinRole', () => {
    it('returns 401 when unauthenticated (no session)', async () => {
        mockedCreateClient.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: null },
                    error: new Error('no session'),
                }),
            },
        } as any);
        const req = new NextRequest('http://localhost/api/test', { method: 'GET' });

        const result = await requireMinRole(req, 'USER');

        expect(result.error?.status).toBe(401);
        expect(result.user).toBeNull();
    });

    it('returns 403 with generic message when role is below minimum', async () => {
        const req = makeRequest();
        mockedGetUserRole.mockResolvedValue('USER' as any);

        const result = await requireMinRole(req, 'QA');

        expect(result.error?.status).toBe(403);
        const body = await result.error?.json() as { error: string };
        expect(body.error).toBe('Forbidden - insufficient role');
        expect(result.user).toBeNull();
    });

    it('returns user when role exactly meets the minimum', async () => {
        const req = makeRequest();
        mockedGetUserRole.mockResolvedValue('QA' as any);

        const result = await requireMinRole(req, 'QA');

        expect(result.error).toBeNull();
        expect(result.user?.id).toBe('user-1');
        expect(result.role).toBe('QA');
    });

    it('returns user when role exceeds the minimum', async () => {
        const req = makeRequest();
        mockedGetUserRole.mockResolvedValue('ADMIN' as any);

        const result = await requireMinRole(req, 'FLEET');

        expect(result.error).toBeNull();
        expect(result.role).toBe('ADMIN');
    });

    it('MANAGER passes when minRole is FLEET (equal weight 4)', async () => {
        const req = makeRequest();
        mockedGetUserRole.mockResolvedValue('MANAGER' as any);

        const result = await requireMinRole(req, 'FLEET');

        expect(result.error).toBeNull();
        expect(result.role).toBe('MANAGER');
    });

    it('FLEET passes when minRole is MANAGER (equal weight 4)', async () => {
        const req = makeRequest();
        mockedGetUserRole.mockResolvedValue('FLEET' as any);

        const result = await requireMinRole(req, 'MANAGER');

        expect(result.error).toBeNull();
        expect(result.role).toBe('FLEET');
    });

    it('PENDING is rejected for any non-PENDING minRole', async () => {
        const req = makeRequest();
        mockedGetUserRole.mockResolvedValue('PENDING' as any);

        const result = await requireMinRole(req, 'USER');

        expect(result.error?.status).toBe(403);
    });

    it('ADMIN passes for every minRole in the hierarchy', async () => {
        const roles = ['PENDING', 'USER', 'QA', 'CORE', 'FLEET', 'MANAGER', 'ADMIN'] as const;
        for (const minRole of roles) {
            const req = makeRequest();
            mockedGetUserRole.mockResolvedValue('ADMIN' as any);

            const result = await requireMinRole(req, minRole);
            expect(result.error).toBeNull();
        }
    });

    it('QA is rejected for CORE and above, accepted for QA and below', async () => {
        const req1 = makeRequest();
        mockedGetUserRole.mockResolvedValue('QA' as any);
        expect((await requireMinRole(req1, 'CORE')).error?.status).toBe(403);

        const req2 = makeRequest();
        mockedGetUserRole.mockResolvedValue('QA' as any);
        expect((await requireMinRole(req2, 'QA')).error).toBeNull();

        const req3 = makeRequest();
        mockedGetUserRole.mockResolvedValue('QA' as any);
        expect((await requireMinRole(req3, 'USER')).error).toBeNull();
    });
});
