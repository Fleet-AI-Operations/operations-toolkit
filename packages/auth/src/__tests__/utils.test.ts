import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@repo/database', () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
    },
  },
}));

// Import after mocks are set up
import { getUserRole, invalidateRoleCache } from '../utils';

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
