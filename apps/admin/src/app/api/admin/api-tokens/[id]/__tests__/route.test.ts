import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from '../route';

vi.mock('@/lib/auth-helpers', () => ({ requireAdminRole: vi.fn() }));
vi.mock('@repo/database', () => ({
  prisma: {
    apiToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock('@repo/core/audit', () => ({ logAudit: vi.fn() }));

const ADMIN_USER = { id: 'admin-uuid-1', email: 'admin@example.com', role: 'ADMIN' };

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) } as any;
}

describe('DELETE /api/admin/api-tokens/[id]', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAdminRole } = await import('@/lib/auth-helpers');
    vi.mocked(requireAdminRole).mockResolvedValue({ user: ADMIN_USER });

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 't1', ownerId: ADMIN_USER.id, name: 'Ingest Script', revokedAt: null,
    } as any);
    vi.mocked(prisma.apiToken.update).mockResolvedValue({} as any);
  });

  it('returns 401 when not authenticated', async () => {
    const { requireAdminRole } = await import('@/lib/auth-helpers');
    vi.mocked(requireAdminRole).mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }) as any,
    });

    const res = await DELETE(new Request('http://localhost'), makeParams('t1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when token does not exist', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue(null);

    const res = await DELETE(new Request('http://localhost'), makeParams('t1'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when token belongs to a different user', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 't1', ownerId: 'some-other-admin', name: 'Their Token', revokedAt: null,
    } as any);

    const res = await DELETE(new Request('http://localhost'), makeParams('t1'));
    expect(res.status).toBe(404);
  });

  it('returns 409 when token is already revoked', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 't1', ownerId: ADMIN_USER.id, name: 'Old Token', revokedAt: new Date(),
    } as any);

    const res = await DELETE(new Request('http://localhost'), makeParams('t1'));
    expect(res.status).toBe(409);
  });

  it('returns 200 on successful revocation', async () => {
    const res = await DELETE(new Request('http://localhost'), makeParams('t1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('sets revokedAt to the current time in the database', async () => {
    const { prisma } = await import('@repo/database');
    const before = new Date();

    await DELETE(new Request('http://localhost'), makeParams('t1'));

    const updateCall = vi.mocked(prisma.apiToken.update).mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: 't1' });
    expect((updateCall.data as any).revokedAt).toBeInstanceOf(Date);
    expect((updateCall.data as any).revokedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
