import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

vi.mock('@repo/auth/server', () => ({ createClient: vi.fn() }));
vi.mock('@repo/database', () => ({
  prisma: {
    likertScore: { findMany: vi.fn(), create: vi.fn() },
    dataRecord: { findMany: vi.fn() },
  },
}));

const AUTH_USER = { id: 'user-1' };

function makeAuthClient(user: { id: string } | null = AUTH_USER, role = 'USER') {
  return {
    auth: {
      getUser: vi.fn(() => ({
        data: { user },
        error: user ? null : new Error('no session'),
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: { role }, error: null })),
        })),
      })),
    })),
  };
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/records/likert');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/records/likert', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_RECORDS = [{ id: 'rec-1', content: 'Write a story', type: 'TASK' }];

describe('GET /api/records/likert', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any);

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.likertScore.findMany).mockResolvedValue([]);
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue(SAMPLE_RECORDS as any);
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null) as any);

    const res = await GET(makeGetRequest({ environment: 'prod', userId: 'user-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 when userId matches authenticated user (any role)', async () => {
    const res = await GET(makeGetRequest({ environment: 'prod', userId: AUTH_USER.id }));
    expect(res.status).toBe(200);
  });

  it('returns 403 when userId differs from authenticated user with USER role', async () => {
    const res = await GET(makeGetRequest({ environment: 'prod', userId: 'other-user' }));
    expect(res.status).toBe(403);
  });

  it('returns 200 when userId differs but caller has FLEET role (IDOR elevation)', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(AUTH_USER, 'FLEET') as any);

    const res = await GET(makeGetRequest({ environment: 'prod', userId: 'other-user' }));
    expect(res.status).toBe(200);
  });

  it('returns 200 when userId differs but caller has ADMIN role (IDOR elevation)', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(AUTH_USER, 'ADMIN') as any);

    const res = await GET(makeGetRequest({ environment: 'prod', userId: 'other-user' }));
    expect(res.status).toBe(200);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it('returns 400 when environment is missing', async () => {
    const res = await GET(makeGetRequest({ userId: AUTH_USER.id }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when userId is missing', async () => {
    const res = await GET(makeGetRequest({ environment: 'prod' }));
    expect(res.status).toBe(400);
  });

  // ── Query behaviour ───────────────────────────────────────────────────────

  it('returns records excluding already rated ones', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.likertScore.findMany).mockResolvedValue([{ recordId: 'rec-already' }] as any);

    await GET(makeGetRequest({ environment: 'prod', userId: AUTH_USER.id }));

    expect(prisma.dataRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: ['rec-already'] } }),
      })
    );
  });

  it('returns records array in response', async () => {
    const res = await GET(makeGetRequest({ environment: 'prod', userId: AUTH_USER.id }));
    const data = await res.json();
    expect(data.records).toHaveLength(1);
    expect(data.records[0].id).toBe('rec-1');
  });
});

describe('POST /api/records/likert', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any);

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.likertScore.create).mockResolvedValue({ id: 'lks-1' } as any);
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null) as any);

    const res = await POST(makePostRequest({ recordId: 'r1', userId: 'user-1', realismScore: 5, qualityScore: 5 }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when userId in body does not match authenticated user (IDOR)', async () => {
    const res = await POST(
      makePostRequest({ recordId: 'r1', userId: 'attacker-user', realismScore: 5, qualityScore: 5 })
    );
    expect(res.status).toBe(403);
  });

  it('returns 200 when userId matches authenticated user', async () => {
    const res = await POST(
      makePostRequest({ recordId: 'r1', userId: AUTH_USER.id, realismScore: 5, qualityScore: 5 })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makePostRequest({ recordId: 'r1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when realismScore is below 1', async () => {
    const res = await POST(
      makePostRequest({ recordId: 'r1', userId: AUTH_USER.id, realismScore: 0, qualityScore: 5 })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/1 and 7/i);
  });

  it('returns 400 when qualityScore is above 7', async () => {
    const res = await POST(
      makePostRequest({ recordId: 'r1', userId: AUTH_USER.id, realismScore: 5, qualityScore: 8 })
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate submission (unique constraint)', async () => {
    const { prisma } = await import('@repo/database');
    const err = Object.assign(new Error('unique'), { code: 'P2002' });
    vi.mocked(prisma.likertScore.create).mockRejectedValue(err);

    const res = await POST(
      makePostRequest({ recordId: 'r1', userId: AUTH_USER.id, realismScore: 5, qualityScore: 5 })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already rated/i);
  });
});
