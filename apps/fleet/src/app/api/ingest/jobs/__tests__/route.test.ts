import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@repo/auth/server', () => ({ createClient: vi.fn() }));
vi.mock('@repo/database', () => ({
  prisma: { ingestJob: { findMany: vi.fn() } },
}));

function makeAuthClient(user: { id: string } | null = { id: 'user-1' }, role = 'FLEET') {
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
          single: vi.fn(() => ({ data: user ? { role } : null, error: null })),
        })),
      })),
    })),
  };
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/ingest/jobs');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

const SAMPLE_JOBS = [
  { id: 'j1', environment: 'prod', status: 'COMPLETED', createdAt: new Date() },
  { id: 'j2', environment: 'staging', status: 'PENDING', createdAt: new Date() },
];

describe('GET /api/ingest/jobs', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any);

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.ingestJob.findMany).mockResolvedValue(SAMPLE_JOBS as any);
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null) as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 for USER role', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient({ id: 'u1' }, 'USER') as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 403 for QA role', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient({ id: 'u1' }, 'QA') as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 403 for CORE role', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient({ id: 'u1' }, 'CORE') as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 200 for FLEET role', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it('returns 200 for MANAGER role', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient({ id: 'u1' }, 'MANAGER') as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it('returns 200 for ADMIN role', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient({ id: 'u1' }, 'ADMIN') as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  // ── Query behaviour ───────────────────────────────────────────────────────

  it('returns all jobs when no environment filter provided', async () => {
    const { prisma } = await import('@repo/database');
    const findMany = vi.mocked(prisma.ingestJob.findMany);

    await GET(makeRequest());

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('filters by environment when provided', async () => {
    const { prisma } = await import('@repo/database');
    const findMany = vi.mocked(prisma.ingestJob.findMany);

    await GET(makeRequest({ environment: 'prod' }));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { environment: 'prod' } })
    );
  });

  it('orders by createdAt DESC and limits to 20', async () => {
    const { prisma } = await import('@repo/database');
    const findMany = vi.mocked(prisma.ingestJob.findMany);

    await GET(makeRequest());

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    );
  });

  it('returns the jobs array from the database', async () => {
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('j1');
  });

  it('returns 500 on database error without leaking details', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.ingestJob.findMany).mockRejectedValue(new Error('DB gone'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to fetch jobs');
    expect(JSON.stringify(data)).not.toContain('DB gone');
  });
});
