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
    $queryRaw: vi.fn(),
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeRecord(overrides: Record<string, any> = {}) {
  return {
    id: 'rec-uuid-1',
    createdByEmail: 'alice@example.com',
    createdByName: 'Alice Worker',
    environment: 'prod',
    metadata: { task_key: 'task-key-abc' },
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
    // Default: fuzzy fallback returns empty (exact match succeeds first)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
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

  it('returns 400 when q exceeds 200 characters', async () => {
    const longQ = 'a'.repeat(201);
    const res = await GET(new NextRequest(`http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=${longQ}`));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/200 characters/i);
  });

  it('returns creator info when found by exact match', async () => {
    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=rec-uuid-1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].email).toBe('alice@example.com');
    expect(data.results[0].name).toBe('Alice Worker');
    expect(data.results[0].environment).toBe('prod');
    expect(data.results[0].recordId).toBe('rec-uuid-1');
    expect(data.results[0].taskKey).toBe('task-key-abc');
    expect(data.matchType).toBe('exact');
  });

  it('queries exact match by both id and metadata.task_key', async () => {
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

  it('falls back to fuzzy ILIKE when exact match finds nothing', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: 'rec-2', createdByEmail: 'bob@example.com', createdByName: 'Bob', environment: 'staging', taskKey: 'task-key-abc-v2' },
    ]);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=task-key-abc'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].email).toBe('bob@example.com');
    expect(data.results[0].taskKey).toBe('task-key-abc-v2');
    expect(data.matchType).toBe('fuzzy');
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('returns multiple fuzzy matches when several records match', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: 'rec-a', createdByEmail: 'a@example.com', createdByName: 'Alice', environment: 'prod', taskKey: 'task-abc-1' },
      { id: 'rec-b', createdByEmail: 'b@example.com', createdByName: 'Bob', environment: 'prod', taskKey: 'task-abc-2' },
    ]);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=task-abc'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(2);
    expect(data.results[0].email).toBe('a@example.com');
    expect(data.results[0].taskKey).toBe('task-abc-1');
    expect(data.results[1].email).toBe('b@example.com');
    expect(data.results[1].taskKey).toBe('task-abc-2');
    expect(data.matchType).toBe('fuzzy');
  });

  it('falls through to fuzzy phase when exact match record has null email', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(
      makeRecord({ createdByEmail: null }) as any
    );
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: 'rec-2', createdByEmail: 'bob@example.com', createdByName: 'Bob', environment: 'prod', taskKey: 'task-key-abc' },
    ]);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=task-key-abc'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(data.results[0].email).toBe('bob@example.com');
    expect(data.matchType).toBe('fuzzy');
  });

  it('returns 404 when neither exact nor fuzzy match finds anything', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=unknown-key'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/no task found/i);
  });

  it('handles null name and environment gracefully', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(
      makeRecord({ createdByName: null, environment: null }) as any
    );

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=rec-uuid-1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results[0].name).toBeNull();
    expect(data.results[0].environment).toBeNull();
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

  it('does not error when q contains LIKE wildcard characters', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: 'rec-x', createdByEmail: 'x@example.com', createdByName: 'X', environment: 'prod', taskKey: 'task-50%-done' },
    ]);

    // q=50% (URL-encoded as 50%25)
    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=50%25'));
    expect(res.status).toBe(200);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('returns 500 on database error in the exact match phase', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockRejectedValue(new Error('DB down'));

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=some-key'));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/internal server error/i);
    expect(data.details).toBeUndefined();
  });

  it('returns 500 on database error in the fuzzy phase', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('raw query failed'));

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=some-key'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/internal server error/i);
  });

  it('returns 500 when profile fetch fails (not 403)', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: new Error('profiles table unreachable') })),
          })),
        })),
      })),
    } as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/lookup?q=some-key'));
    expect(res.status).toBe(500);
  });
});
