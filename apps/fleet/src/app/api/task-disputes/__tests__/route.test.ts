import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// The route uses requireRole from @repo/api-utils — mock it directly.
vi.mock('@repo/api-utils', () => ({ requireRole: vi.fn() }));
vi.mock('@repo/database', () => ({
  prisma: {
    taskDispute: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

const FLEET_USER = { id: 'user-1', email: 'fleet@example.com', role: 'FLEET' };

const makeAuthSuccess = (user = FLEET_USER) => ({ user, error: null });
const makeAuthError = (status: number) => ({
  error: Response.json({ error: 'Unauthorized' }, { status }) as any,
});

const makeRequest = (params: Record<string, string> = {}) => {
  const url = new URL('http://localhost:3004/api/task-disputes');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
};

const SAMPLE_DISPUTE = {
  id: 'dispute-uuid-1',
  externalId: 1001,
  createdAtSource: new Date('2026-01-15'),
  feedbackId: 500,
  evalTaskId: null,
  disputeStatus: 'pending',
  disputeReason: 'Incorrect feedback',
  resolutionReason: null,
  resolvedAt: null,
  reportText: null,
  isHelpful: null,
  disputerName: 'Jane Smith',
  disputerEmail: 'jane@example.com',
  resolverName: null,
  teamName: 'Task Designers',
  taskKey: 'task_abc123_1234567890_xyz',
  taskLifecycleStatus: null,
  envKey: 'fos-accounting',
  envDataKey: null,
  taskModality: 'computer_use',
  disputeData: null,
  dataRecord: null,
};

describe('GET /api/task-disputes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthSuccess() as any);

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.findMany).mockResolvedValue([SAMPLE_DISPUTE] as any);
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(1 as any);
    vi.mocked(prisma.taskDispute.groupBy).mockResolvedValue([] as any);
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthError(401) as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 for insufficient role', async () => {
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthError(403) as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns 200 with disputes and stats', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count)
      .mockResolvedValueOnce(1)   // filtered total
      .mockResolvedValueOnce(0)   // matchedCount
      .mockResolvedValueOnce(1);  // grandTotal

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.disputes).toHaveLength(1);
    expect(data.disputes[0].externalId).toBe(1001);
    expect(data.stats).toBeDefined();
    expect(data.page).toBe(1);
  });

  it('passes pagination params to findMany', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest({ page: '2', limit: '25' }));

    expect(vi.mocked(prisma.taskDispute.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 25, take: 25 })
    );
  });

  it('applies status filter to where clause', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest({ status: 'approved' }));

    expect(vi.mocked(prisma.taskDispute.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ disputeStatus: 'approved' }) })
    );
  });

  it('applies env filter to where clause', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest({ env: 'fos-accounting' }));

    expect(vi.mocked(prisma.taskDispute.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ envKey: 'fos-accounting' }) })
    );
  });

  it('applies search filter as OR across person name and email fields', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest({ search: 'jane' }));

    expect(vi.mocked(prisma.taskDispute.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { disputerName: { contains: 'jane', mode: 'insensitive' } },
            { disputerEmail: { contains: 'jane', mode: 'insensitive' } },
            { qaReviewerName: { contains: 'jane', mode: 'insensitive' } },
            { qaReviewerEmail: { contains: 'jane', mode: 'insensitive' } },
            { resolverName: { contains: 'jane', mode: 'insensitive' } },
          ]),
        }),
      })
    );
  });

  it('omits OR clause from where when search param is absent', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest());

    const call = vi.mocked(prisma.taskDispute.findMany).mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
  });

  it('omits OR clause from where when search param is empty string', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest({ search: '' }));

    const call = vi.mocked(prisma.taskDispute.findMany).mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
  });

  it('combines search OR clause with other filters in the same where object', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest({ search: 'jane', status: 'pending' }));

    expect(vi.mocked(prisma.taskDispute.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          disputeStatus: 'pending',
          OR: expect.arrayContaining([
            { disputerName: { contains: 'jane', mode: 'insensitive' } },
          ]),
        }),
      })
    );
  });

  it('truncates search param to 200 chars', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    const longSearch = 'a'.repeat(300);
    await GET(makeRequest({ search: longSearch }));

    const call = vi.mocked(prisma.taskDispute.findMany).mock.calls[0][0];
    const orClause = call.where as any;
    expect(orClause.OR[0].disputerName.contains).toHaveLength(200);
  });

  it('applies taskKey filter as case-insensitive contains', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest({ taskKey: 'task_abc' }));

    expect(vi.mocked(prisma.taskDispute.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          taskKey: { contains: 'task_abc', mode: 'insensitive' },
        }),
      })
    );
  });

  it('filters to matched-only when matched=true', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest({ matched: 'true' }));

    expect(vi.mocked(prisma.taskDispute.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ evalTaskId: { not: null } }),
      })
    );
  });

  it('filters to unmatched-only when matched=false', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest({ matched: 'false' }));

    expect(vi.mocked(prisma.taskDispute.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ evalTaskId: null }),
      })
    );
  });

  it('caps limit at 200', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.count).mockResolvedValue(0 as any);

    await GET(makeRequest({ limit: '9999' }));

    expect(vi.mocked(prisma.taskDispute.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    );
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('returns 500 on database error', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.findMany).mockRejectedValue(new Error('DB error'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
