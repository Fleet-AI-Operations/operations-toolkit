import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

vi.mock('@/lib/auth-helpers', () => ({ requireAdminRole: vi.fn() }));
vi.mock('@repo/database', () => ({
  prisma: {
    apiToken: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock('@repo/core/audit', () => ({ logAudit: vi.fn() }));

const ADMIN_USER = { id: 'admin-uuid-1', email: 'admin@example.com', role: 'ADMIN' };

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/api-tokens', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_TOKENS = [
  {
    id: 't1', name: 'Ingest Script', tokenPrefix: 'abcd1234',
    lastUsedAt: null, expiresAt: null, revokedAt: null, createdAt: new Date(),
  },
];

describe('GET /api/admin/api-tokens', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAdminRole } = await import('@/lib/auth-helpers');
    vi.mocked(requireAdminRole).mockResolvedValue({ user: ADMIN_USER });

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findMany).mockResolvedValue(SAMPLE_TOKENS as any);
  });

  it('returns 401 when not authenticated', async () => {
    const { requireAdminRole } = await import('@/lib/auth-helpers');
    vi.mocked(requireAdminRole).mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }) as any,
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with the token list for an admin', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('t1');
  });

  it('only fetches tokens owned by the requesting user', async () => {
    const { prisma } = await import('@repo/database');
    await GET();
    expect(vi.mocked(prisma.apiToken.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: ADMIN_USER.id } })
    );
  });

  it('orders results by createdAt descending', async () => {
    const { prisma } = await import('@repo/database');
    await GET();
    expect(vi.mocked(prisma.apiToken.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });

  it('does not include tokenHash in the Prisma select clause', async () => {
    const { prisma } = await import('@repo/database');
    await GET();
    const selectArg = vi.mocked(prisma.apiToken.findMany).mock.calls[0][0].select;
    expect(selectArg).not.toHaveProperty('tokenHash');
  });
});

describe('POST /api/admin/api-tokens', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAdminRole } = await import('@/lib/auth-helpers');
    vi.mocked(requireAdminRole).mockResolvedValue({ user: ADMIN_USER });

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.create).mockResolvedValue({
      id: 't2', name: 'New Token', tokenPrefix: 'deadbeef',
      expiresAt: null, createdAt: new Date(),
    } as any);
  });

  it('returns 401 when not authenticated', async () => {
    const { requireAdminRole } = await import('@/lib/auth-helpers');
    vi.mocked(requireAdminRole).mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }) as any,
    });

    const res = await POST(makePostRequest({ name: 'My Token' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/name/i);
  });

  it('returns 400 when name is blank whitespace', async () => {
    const res = await POST(makePostRequest({ name: '   ' }));
    expect(res.status).toBe(400);
  });

  it('returns 201 with plaintext token on success', async () => {
    const res = await POST(makePostRequest({ name: 'Ingest Script' }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.token).toMatch(/^otk_[a-f0-9]{64}$/);
    expect(data.id).toBe('t2');
    expect(data.name).toBe('New Token');
  });

  it('stores the SHA-256 hash, not the plaintext token', async () => {
    const { prisma } = await import('@repo/database');
    const create = vi.mocked(prisma.apiToken.create);

    const res = await POST(makePostRequest({ name: 'Ingest Script' }));
    const { token } = await res.json();

    const createData = create.mock.calls[0][0].data;
    expect(createData).not.toHaveProperty('token');
    expect(createData.tokenHash).not.toBe(token);
    expect(createData.tokenHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('stores the first 8 hex chars as tokenPrefix', async () => {
    const { prisma } = await import('@repo/database');
    const create = vi.mocked(prisma.apiToken.create);

    const res = await POST(makePostRequest({ name: 'Ingest Script' }));
    const { token } = await res.json();

    const rawHex = token.slice('otk_'.length);
    expect(create.mock.calls[0][0].data.tokenPrefix).toBe(rawHex.slice(0, 8));
  });

  it('passes expiresAt to the database when provided', async () => {
    const { prisma } = await import('@repo/database');
    const create = vi.mocked(prisma.apiToken.create);

    await POST(makePostRequest({ name: 'Temp Token', expiresAt: '2099-12-31' }));

    expect(create.mock.calls[0][0].data.expiresAt).toEqual(new Date('2099-12-31'));
  });

  it('sets expiresAt to null when not provided', async () => {
    const { prisma } = await import('@repo/database');
    const create = vi.mocked(prisma.apiToken.create);

    await POST(makePostRequest({ name: 'No Expiry Token' }));

    expect(create.mock.calls[0][0].data.expiresAt).toBeNull();
  });
});
