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
    dataRecord: { findMany: vi.fn() },
  },
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/prompt-authenticity/user-deep-dive/users', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue(makeAuthClient() as any);
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
      { createdByEmail: 'alice@example.com', createdByName: 'Alice' },
      { createdByEmail: 'alice@example.com', createdByName: 'Alice' },
      { createdByEmail: 'bob@example.com', createdByName: 'Bob' },
    ] as any);
  });

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn(() => ({ data: { user: null }, error: new Error('no session') })) },
    } as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/users'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for insufficient role', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue(makeAuthClient('QA') as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/users'));
    expect(res.status).toBe(403);
  });

  it('returns aggregated user list with task counts', async () => {
    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/users'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.users).toHaveLength(2);

    const alice = data.users.find((u: any) => u.email === 'alice@example.com');
    expect(alice.taskCount).toBe(2);
    expect(alice.name).toBe('Alice');

    const bob = data.users.find((u: any) => u.email === 'bob@example.com');
    expect(bob.taskCount).toBe(1);
  });

  it('returns users sorted alphabetically by name', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
      { createdByEmail: 'zara@example.com', createdByName: 'Zara' },
      { createdByEmail: 'alice@example.com', createdByName: 'Alice' },
      { createdByEmail: 'mike@example.com', createdByName: 'Mike' },
    ] as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/users'));
    const data = await res.json();
    const names = data.users.map((u: any) => u.name);
    expect(names).toEqual(['Alice', 'Mike', 'Zara']);
  });

  it('excludes @fleet.so email addresses', async () => {
    const { prisma } = await import('@repo/database');
    // The DB filter handles this, but verify the where clause is constructed correctly
    const findMany = vi.mocked(prisma.dataRecord.findMany);

    await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/users'));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: expect.objectContaining({
            createdByEmail: expect.objectContaining({ endsWith: '@fleet.so', mode: 'insensitive' }),
          }),
        }),
      })
    );
  });

  it('deduplicates emails case-insensitively', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
      { createdByEmail: 'Alice@Example.com', createdByName: 'Alice' },
      { createdByEmail: 'alice@example.com', createdByName: 'Alice' },
    ] as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/users'));
    const data = await res.json();
    expect(data.users).toHaveLength(1);
    expect(data.users[0].taskCount).toBe(2);
  });

  it('filters by environment when provided', async () => {
    const { prisma } = await import('@repo/database');
    const findMany = vi.mocked(prisma.dataRecord.findMany);

    await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/users?environment=staging'));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ environment: 'staging' }) })
    );
  });

  it('returns 500 on database error', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockRejectedValue(new Error('DB down'));

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/users'));
    expect(res.status).toBe(500);
  });

  it('returns 500 (not 403) when the profile fetch fails', async () => {
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

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/users'));
    expect(res.status).toBe(500);
  });
});
