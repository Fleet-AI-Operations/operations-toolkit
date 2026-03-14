import { createHash } from 'node:crypto';
import { prisma } from '@repo/database';
import type { UserRole } from '@repo/types';

// Module-level cache — persists across requests in the same server process.
// Avoids a DB round-trip on every API request for the same user.
//
// Known limitation: this is an in-process cache. In a multi-app deployment (e.g. separate
// Vercel instances for Fleet, QA, Core, Admin), each app has its own cache. Calling
// invalidateRoleCache() in the Admin app only clears that app's cache — other apps will
// continue serving the stale role until the TTL expires. The 30-second TTL bounds the
// worst case.
const ROLE_CACHE_TTL_MS = 30 * 1000; // 30 seconds — bounds the window for revoked permissions in multi-app deployments

interface CachedRole {
  role: UserRole;
  expiresAt: number;
}

const roleCache = new Map<string, CachedRole>();

/**
 * Invalidate the cached role for a specific user.
 * Call this after any admin operation that changes a user's role.
 */
export function invalidateRoleCache(userId: string): void {
  roleCache.delete(userId);
}

/**
 * Get user role from the database by user ID.
 * Results are cached in-process for 30 seconds to avoid a DB round-trip on every request.
 * @param userId - The user's UUID
 * @returns The user's role
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  const now = Date.now();
  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.role;
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true }
  });
  if (!profile) {
    console.error(`[getUserRole] No profile found for userId=${userId}. User is authenticated in Supabase but has no profile row. Defaulting to PENDING.`);
  }
  const role = (profile?.role ?? 'PENDING') as UserRole;

  roleCache.set(userId, { role, expiresAt: now + ROLE_CACHE_TTL_MS });
  return role;
}

/**
 * Get full user profile from the database by user ID
 * @param userId - The user's UUID
 * @returns The user's profile or null if not found
 */
export async function getUserProfile(userId: string) {
  return prisma.profile.findUnique({
    where: { id: userId }
  });
}

/**
 * Check if a user has a specific role
 * @param userId - The user's UUID
 * @param role - The role to check for
 * @returns True if the user has the specified role, false otherwise
 */
export async function hasRole(userId: string, role: UserRole): Promise<boolean> {
  const userRole = await getUserRole(userId);
  return userRole === role;
}

/**
 * Validate a raw API token string and return the owning user's id and email.
 * Returns null if the token is invalid, revoked, or expired.
 * Updates last_used_at non-blocking on success.
 */
export async function authenticateWithToken(
  tokenValue: string
): Promise<{ id: string; email: string } | null> {
  if (!tokenValue.startsWith('otk_')) return null;

  const hash = createHash('sha256').update(tokenValue).digest('hex');

  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
    select: {
      id: true,
      ownerId: true,
      revokedAt: true,
      expiresAt: true,
      owner: { select: { email: true } },
    },
  });

  if (!token) return null;
  if (token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt < new Date()) return null;

  // Fire-and-forget — don't block the request
  prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch((err) => {
      console.error('[authenticateWithToken] Failed to update lastUsedAt for token:', token.id, err);
    });

  return { id: token.ownerId, email: token.owner.email };
}
