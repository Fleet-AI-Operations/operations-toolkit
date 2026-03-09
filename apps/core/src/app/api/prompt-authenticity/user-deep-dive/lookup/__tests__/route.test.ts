import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// ── Auth mock helpers ──────────────────────────────────────────────────────

function makeAuthClient(role = 'CORE') {
  return {
    auth: {
      getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } }, error: null })),
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

vi.mock('@repo/auth/server', () => ({ createClient: vi.fn() }));

vi.mock('@repo/database', () => ({
  prisma: {
    dataRecord: { findFirst: vi.fn() },
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeRecord(overrides: Record<string, any> = {}) {
  return {
    id: 'rec-uuid-1',
    createdByEmail: 'alice@example.com',
    createdByName: 'Alice Worker',
    environment: 'prod',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/prompt-authenticity/user-deep-dive/lookup', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue(makeAuthClient() as any);
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(makeRecord() as any);
  });

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn(() => ({ data: { user: null }, error: new Error('no session') })) },
    } as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=some-key'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for insufficient role', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue(makeAuthClient('QA') as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=some-key'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when q param is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/q is required/i);
  });

  it('returns creator info when found by record ID', async () => {
    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=rec-uuid-1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe('alice@example.com');
    expect(data.name).toBe('Alice Worker');
    expect(data.environment).toBe('prod');
    expect(data.recordId).toBe('rec-uuid-1');
  });

  it('queries by both id and metadata.task_key', async () => {
    const { prisma } = await import('@repo/database');
    const findFirst = vi.mocked(prisma.dataRecord.findFirst);

    await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=task-key-abc'));

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { id: 'task-key-abc' },
            { metadata: { path: ['task_key'], equals: 'task-key-abc' } },
          ]),
        }),
      })
    );
  });

  it('returns 404 when no matching task is found', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(null as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=unknown-key'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/no task found/i);
  });

  it('returns 404 when record has no createdByEmail', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(makeRecord({ createdByEmail: null }) as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=rec-uuid-1'));
    expect(res.status).toBe(404);
  });

  it('handles null name and environment gracefully', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(
      makeRecord({ createdByName: null, environment: null }) as any
    );

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=rec-uuid-1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBeNull();
    expect(data.environment).toBeNull();
  });

  it('trims whitespace from the query param', async () => {
    const { prisma } = await import('@repo/database');
    const findFirst = vi.mocked(prisma.dataRecord.findFirst);

    await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=+task-key+'));

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ id: 'task-key' }]),
        }),
      })
    );
  });

  it('returns 500 on database error', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockRejectedValue(new Error('DB down'));

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=some-key'));
    expect(res.status).toBe(500);
  });
});
