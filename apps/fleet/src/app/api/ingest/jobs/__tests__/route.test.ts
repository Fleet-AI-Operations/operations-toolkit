import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// The route now uses requireRole from @repo/api-utils — mock it directly.
vi.mock('@repo/api-utils', () => ({ requireRole: vi.fn() }));
vi.mock('@repo/database', () => ({
  prisma: { ingestJob: { findMany: vi.fn() } },
}));

function makeAuthSuccess(id = 'user-1', role = 'FLEET') {
  return { user: { id, email: `${id}@example.com` }, role, error: null };
}

function makeAuthError(status: number) {
  return {
    user: null,
    role: null,
    error: Response.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
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
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthSuccess() as any);

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.ingestJob.findMany).mockResolvedValue(SAMPLE_JOBS as any);
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthError(401) as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 for USER role', async () => {
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthError(403) as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 403 for QA role', async () => {
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthError(403) as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 403 for CORE role', async () => {
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthError(403) as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 200 for FLEET role', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it('returns 200 for ADMIN role', async () => {
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthSuccess('u1', 'ADMIN') as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  // ── Query behaviour ───────────────────────────────────────────────────────

  it('returns all jobs when no environment filter provided', async () => {
    const { prisma } = await import('@repo/database');
    await GET(makeRequest());
    expect(vi.mocked(prisma.ingestJob.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('filters by environment when provided', async () => {
    const { prisma } = await import('@repo/database');
    await GET(makeRequest({ environment: 'prod' }));
    expect(vi.mocked(prisma.ingestJob.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { environment: 'prod' } })
    );
  });

  it('orders by createdAt DESC and limits to 20', async () => {
    const { prisma } = await import('@repo/database');
    await GET(makeRequest());
    expect(vi.mocked(prisma.ingestJob.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 20 })
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
