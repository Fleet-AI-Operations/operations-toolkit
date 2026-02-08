import { prisma } from '@repo/database';
/**
 * Get user role from the database by user ID
 * @param userId - The user's UUID
 * @returns The user's role (USER, MANAGER, or ADMIN)
 */
export async function getUserRole(userId) {
    const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { role: true }
    });
    return profile?.role || 'USER';
}
/**
 * Get full user profile from the database by user ID
 * @param userId - The user's UUID
 * @returns The user's profile or null if not found
 */
export async function getUserProfile(userId) {
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
export async function hasRole(userId, role) {
    const userRole = await getUserRole(userId);
    return userRole === role;
}
