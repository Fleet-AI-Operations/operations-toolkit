import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdminRole, requireManagerRole } from '../auth-helpers';

vi.mock('@repo/auth/server', () => ({ createClient: vi.fn() }));

function makeAuthClient(user: { id: string; email: string } | null, role: string | null) {
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
          single: vi.fn(() => ({
            data: role ? { role } : null,
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe('requireAdminRole', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ id: 'admin-1', email: 'admin@example.com' }, 'ADMIN') as any
    );
  });

  it('returns { user } with id and email when caller is ADMIN', async () => {
    const result = await requireAdminRole();
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.user.id).toBe('admin-1');
      expect(result.user.email).toBe('admin@example.com');
      expect(result.user.role).toBe('ADMIN');
    }
  });

  it('returns 401 { error } when unauthenticated', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null, null) as any);

    const result = await requireAdminRole();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(401);
    }
  });

  it('returns 403 { error } when role is MANAGER', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ id: 'mgr-1', email: 'm@example.com' }, 'MANAGER') as any
    );

    const result = await requireAdminRole();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
  });

  it('returns 403 { error } when role is FLEET', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ id: 'f1', email: 'f@example.com' }, 'FLEET') as any
    );

    const result = await requireAdminRole();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
  });

  it('returns 403 { error } when role is USER', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ id: 'u1', email: 'u@example.com' }, 'USER') as any
    );

    const result = await requireAdminRole();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
  });

  it('returns 403 { error } when profile is null (no DB record)', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ id: 'u1', email: 'u@example.com' }, null) as any
    );

    const result = await requireAdminRole();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
  });

  it('returns 403 { error } when profile DB query returns an error and logs it', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(() => ({
          data: { user: { id: 'u1', email: 'u@example.com' } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: new Error('DB connection refused') })),
          })),
        })),
      })),
    } as any);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await requireAdminRole();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('requireAdminRole'),
      'u1',
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});

describe('requireManagerRole', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('returns { user } when role is ADMIN', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ id: 'a1', email: 'a@example.com' }, 'ADMIN') as any
    );

    const result = await requireManagerRole();
    expect('error' in result).toBe(false);
  });

  it('returns { user } when role is MANAGER', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ id: 'm1', email: 'm@example.com' }, 'MANAGER') as any
    );

    const result = await requireManagerRole();
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.user.role).toBe('MANAGER');
    }
  });

  it('returns 401 { error } when unauthenticated', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null, null) as any);

    const result = await requireManagerRole();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(401);
    }
  });

  it('returns 403 { error } when role is FLEET', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ id: 'f1', email: 'f@example.com' }, 'FLEET') as any
    );

    const result = await requireManagerRole();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
  });

  it('returns 403 { error } when role is USER', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ id: 'u1', email: 'u@example.com' }, 'USER') as any
    );

    const result = await requireManagerRole();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
  });
});
