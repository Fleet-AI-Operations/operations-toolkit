import type { UserRole } from '@repo/types';
/**
 * Get user role from the database by user ID
 * @param userId - The user's UUID
 * @returns The user's role (USER, MANAGER, or ADMIN)
 */
export declare function getUserRole(userId: string): Promise<UserRole>;
/**
 * Get full user profile from the database by user ID
 * @param userId - The user's UUID
 * @returns The user's profile or null if not found
 */
export declare function getUserProfile(userId: string): Promise<{
    id: string;
    email: string;
    role: import("@prisma/client").$Enums.UserRole;
    mustResetPassword: boolean;
    createdAt: Date;
    updatedAt: Date;
} | null>;
/**
 * Check if a user has a specific role
 * @param userId - The user's UUID
 * @param role - The role to check for
 * @returns True if the user has the specified role, false otherwise
 */
export declare function hasRole(userId: string, role: UserRole): Promise<boolean>;
//# sourceMappingURL=utils.d.ts.map