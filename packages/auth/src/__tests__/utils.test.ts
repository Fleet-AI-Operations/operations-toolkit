import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@repo/database', () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
    },
    apiToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Import after mocks are set up
import { getUserRole, invalidateRoleCache, authenticateWithToken } from '../utils';

const USER_ID = 'user-uuid-1';

async function mockRole(role: string | null) {
  const { prisma } = await import('@repo/database');
  vi.mocked(prisma.profile.findUnique).mockResolvedValue(
    role ? ({ role } as any) : null
  );
}

describe('getUserRole', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    invalidateRoleCache(USER_ID);
    await mockRole('FLEET');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the role from the database on first call', async () => {
    const role = await getUserRole(USER_ID);
    expect(role).toBe('FLEET');

    const { prisma } = await import('@repo/database');
    expect(prisma.profile.findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns USER as default when profile is not found and logs a warning', async () => {
    await mockRole(null);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const role = await getUserRole(USER_ID);
    expect(role).toBe('USER');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(USER_ID));
    warnSpy.mockRestore();
  });

  it('returns cached result on subsequent calls without hitting the database', async () => {
    await getUserRole(USER_ID);
    await getUserRole(USER_ID);
    await getUserRole(USER_ID);

    const { prisma } = await import('@repo/database');
    // Only one DB call despite three invocations
    expect(prisma.profile.findUnique).toHaveBeenCalledTimes(1);
  });

  it('re-fetches from the database after the 1-minute TTL expires', async () => {
    vi.useFakeTimers();

    await getUserRole(USER_ID);

    // Advance time past the 1-minute TTL
    vi.advanceTimersByTime(61 * 1000);

    await mockRole('ADMIN');
    const role = await getUserRole(USER_ID);

    expect(role).toBe('ADMIN');
    const { prisma } = await import('@repo/database');
    expect(prisma.profile.findUnique).toHaveBeenCalledTimes(2);
  });

  it('does not re-fetch within the TTL window', async () => {
    vi.useFakeTimers();

    await getUserRole(USER_ID);

    // Advance to just before TTL
    vi.advanceTimersByTime(59 * 1000);

    await getUserRole(USER_ID);

    const { prisma } = await import('@repo/database');
    expect(prisma.profile.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('authenticateWithToken', () => {
  const VALID_TOKEN = 'otk_' + 'a'.repeat(64);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for tokens without otk_ prefix', async () => {
    const result = await authenticateWithToken('Bearer some-jwt-token');
    expect(result).toBeNull();

    const { prisma } = await import('@repo/database');
    expect(prisma.apiToken.findUnique).not.toHaveBeenCalled();
  });

  it('returns null for unknown token hash', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue(null);

    const result = await authenticateWithToken(VALID_TOKEN);
    expect(result).toBeNull();
  });

  it('returns null for a revoked token', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 't1', ownerId: 'u1', revokedAt: new Date(), expiresAt: null,
      owner: { email: 'admin@example.com' },
    } as any);

    const result = await authenticateWithToken(VALID_TOKEN);
    expect(result).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 't1', ownerId: 'u1', revokedAt: null,
      expiresAt: new Date('2020-01-01'),
      owner: { email: 'admin@example.com' },
    } as any);

    const result = await authenticateWithToken(VALID_TOKEN);
    expect(result).toBeNull();
  });

  it('returns user for a valid active token with no expiry', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 't1', ownerId: 'u1', revokedAt: null, expiresAt: null,
      owner: { email: 'admin@example.com' },
    } as any);
    vi.mocked(prisma.apiToken.update).mockResolvedValue({} as any);

    const result = await authenticateWithToken(VALID_TOKEN);
    expect(result).toEqual({ id: 'u1', email: 'admin@example.com' });
  });

  it('returns user for a valid token with a future expiry', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 't1', ownerId: 'u1', revokedAt: null,
      expiresAt: new Date('2099-01-01'),
      owner: { email: 'admin@example.com' },
    } as any);
    vi.mocked(prisma.apiToken.update).mockResolvedValue({} as any);

    const result = await authenticateWithToken(VALID_TOKEN);
    expect(result).toEqual({ id: 'u1', email: 'admin@example.com' });
  });

  it('updates lastUsedAt on successful authentication', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 't1', ownerId: 'u1', revokedAt: null, expiresAt: null,
      owner: { email: 'admin@example.com' },
    } as any);
    vi.mocked(prisma.apiToken.update).mockResolvedValue({} as any);

    await authenticateWithToken(VALID_TOKEN);

    expect(vi.mocked(prisma.apiToken.update)).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it('still returns user even if lastUsedAt update fails', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 't1', ownerId: 'u1', revokedAt: null, expiresAt: null,
      owner: { email: 'admin@example.com' },
    } as any);
    vi.mocked(prisma.apiToken.update).mockRejectedValue(new Error('DB gone'));

    await expect(authenticateWithToken(VALID_TOKEN)).resolves.toEqual({
      id: 'u1', email: 'admin@example.com',
    });
  });

  it('hashes the token before DB lookup (does not store plaintext)', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue(null);

    await authenticateWithToken(VALID_TOKEN);

    const callArg = vi.mocked(prisma.apiToken.findUnique).mock.calls[0][0];
    const lookedUpHash = (callArg as any).where.tokenHash;
    expect(lookedUpHash).not.toContain('otk_');
    expect(lookedUpHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });
});

describe('invalidateRoleCache', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    invalidateRoleCache(USER_ID);
    await mockRole('QA');
  });

  it('forces a DB re-fetch on the next getUserRole call', async () => {
    // Populate the cache
    await getUserRole(USER_ID);

    // Change the role in the "DB"
    await mockRole('ADMIN');

    // Invalidate the cache
    invalidateRoleCache(USER_ID);

    const role = await getUserRole(USER_ID);
    expect(role).toBe('ADMIN');

    const { prisma } = await import('@repo/database');
    expect(prisma.profile.findUnique).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for a userId that was never cached', () => {
    // Should not throw
    expect(() => invalidateRoleCache('never-seen-user')).not.toThrow();
  });

  it('does not affect cache entries for other users', async () => {
    const OTHER_USER = 'other-user-uuid';
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.profile.findUnique)
      .mockResolvedValueOnce({ role: 'QA' } as any)   // USER_ID first call
      .mockResolvedValueOnce({ role: 'CORE' } as any); // OTHER_USER first call

    await getUserRole(USER_ID);
    await getUserRole(OTHER_USER);

    // Invalidate only USER_ID
    invalidateRoleCache(USER_ID);

    await mockRole('FLEET');
    await getUserRole(USER_ID);      // re-fetches
    await getUserRole(OTHER_USER);   // still cached

    expect(prisma.profile.findUnique).toHaveBeenCalledTimes(3); // 2 initial + 1 re-fetch for USER_ID
  });
});
