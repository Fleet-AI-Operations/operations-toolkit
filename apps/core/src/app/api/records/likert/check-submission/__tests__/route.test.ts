import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@repo/auth/server', () => ({ createClient: vi.fn() }));
vi.mock('@repo/database', () => ({
  prisma: { likertScore: { findFirst: vi.fn() } },
}));

const AUTH_USER = { id: 'user-1' };

function makeAuthClient(user: { id: string } | null = AUTH_USER) {
  return {
    auth: {
      getUser: vi.fn(() => ({
        data: { user },
        error: user ? null : new Error('no session'),
      })),
    },
  };
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/records/likert/check-submission');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

describe('GET /api/records/likert/check-submission', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any);

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.likertScore.findFirst).mockResolvedValue(null);
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null) as any);

    const res = await GET(makeRequest({ recordId: 'rec-1', userId: AUTH_USER.id }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when userId does not match authenticated user', async () => {
    const res = await GET(makeRequest({ recordId: 'rec-1', userId: 'other-user' }));
    expect(res.status).toBe(403);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it('returns 400 when recordId is missing', async () => {
    const res = await GET(makeRequest({ userId: AUTH_USER.id }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/recordId/i);
  });

  it('returns 400 when userId is missing', async () => {
    const res = await GET(makeRequest({ recordId: 'rec-1' }));
    expect(res.status).toBe(400);
  });

  // ── Score lookup ──────────────────────────────────────────────────────────

  it('returns userScore: false when no score exists', async () => {
    const res = await GET(makeRequest({ recordId: 'rec-1', userId: AUTH_USER.id }));
    expect(res.status).toBe(200);
    expect((await res.json()).userScore).toBe(false);
  });

  it('returns userScore: true when score exists', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.likertScore.findFirst).mockResolvedValue({ id: 'lks-1' } as any);

    const res = await GET(makeRequest({ recordId: 'rec-1', userId: AUTH_USER.id }));
    expect(res.status).toBe(200);
    expect((await res.json()).userScore).toBe(true);
  });

  it('excludes the LLM system UUID from the lookup', async () => {
    const { prisma } = await import('@repo/database');
    const findFirst = vi.mocked(prisma.likertScore.findFirst);

    await GET(makeRequest({ recordId: 'rec-1', userId: AUTH_USER.id }));

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { userId: '00000000-0000-0000-0000-000000000000' },
        }),
      })
    );
  });
});
