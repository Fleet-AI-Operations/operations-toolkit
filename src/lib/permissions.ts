/**
 * Role-based permission system with hierarchical inheritance
 *
 * Role Hierarchy (each role inherits permissions from roles below it):
 * ADMIN → FLEET → CORE → QA → USER
 *
 * USER: User Tools only
 * QA: User Tools + QA Tools
 * CORE: User Tools + QA Tools + Core Tools
 * FLEET: User Tools + QA Tools + Core Tools + Fleet Tools
 * MANAGER: Alias for FLEET (deprecated, use FLEET instead)
 * ADMIN: Full system access
 */

import type { UserRole } from '@prisma/client';

/**
 * Role hierarchy levels (higher number = more permissions)
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  USER: 1,
  QA: 2,
  CORE: 3,
  FLEET: 4,
  MANAGER: 4, // Same as FLEET (deprecated)
  ADMIN: 5,
};

/**
 * Check if a user's role has permission to access a resource requiring a specific role
 * Uses hierarchical inheritance: higher roles inherit lower role permissions
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum role required to access the resource
 * @returns true if user has permission, false otherwise
 *
 * @example
 * hasPermission('FLEET', 'QA') // true - FLEET inherits QA permissions
 * hasPermission('QA', 'CORE')  // false - QA doesn't have CORE permissions
 * hasPermission('ADMIN', 'USER') // true - ADMIN inherits all permissions
 */
export function hasPermission(
  userRole: UserRole | null | undefined,
  requiredRole: UserRole
): boolean {
  if (!userRole) return false;

  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  return userLevel >= requiredLevel;
}

/**
 * Check if user has any of the specified roles (no inheritance)
 *
 * @param userRole - The user's current role
 * @param allowedRoles - Array of roles that are allowed
 * @returns true if user has one of the allowed roles
 *
 * @example
 * hasAnyRole('FLEET', ['FLEET', 'ADMIN']) // true
 * hasAnyRole('QA', ['FLEET', 'ADMIN'])    // false
 */
export function hasAnyRole(
  userRole: UserRole | null | undefined,
  allowedRoles: UserRole[]
): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Check if user has exact role match (no inheritance)
 *
 * @param userRole - The user's current role
 * @param requiredRole - The exact role required
 * @returns true if roles match exactly
 */
export function hasExactRole(
  userRole: UserRole | null | undefined,
  requiredRole: UserRole
): boolean {
  return userRole === requiredRole;
}

/**
 * Get all roles that a user has access to (including inherited roles)
 * Note: Excludes deprecated MANAGER role
 *
 * @param userRole - The user's current role
 * @returns Array of roles the user has access to (MANAGER excluded)
 *
 * @example
 * getAccessibleRoles('CORE') // ['USER', 'QA', 'CORE']
 * getAccessibleRoles('ADMIN') // ['USER', 'QA', 'CORE', 'FLEET', 'ADMIN']
 */
export function getAccessibleRoles(userRole: UserRole): UserRole[] {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;

  return (Object.entries(ROLE_HIERARCHY) as [UserRole, number][])
    .filter(([role, level]) => level > 0 && level <= userLevel && role !== 'MANAGER')
    .sort(([, levelA], [, levelB]) => levelA - levelB)
    .map(([role]) => role);
}

/**
 * Permission sections corresponding to navigation structure
 */
export const PERMISSION_SECTIONS = {
  USER_TOOLS: 'USER' as UserRole,
  QA_TOOLS: 'QA' as UserRole,
  CORE_TOOLS: 'CORE' as UserRole,
  FLEET_TOOLS: 'FLEET' as UserRole,
  ADMIN_TOOLS: 'ADMIN' as UserRole,
} as const;

/**
 * Check if user can access a specific permission section
 *
 * @param userRole - The user's current role
 * @param section - The permission section to check
 * @returns true if user can access the section
 *
 * @example
 * canAccessSection('QA', PERMISSION_SECTIONS.QA_TOOLS) // true
 * canAccessSection('QA', PERMISSION_SECTIONS.CORE_TOOLS) // false
 */
export function canAccessSection(
  userRole: UserRole | null | undefined,
  section: UserRole
): boolean {
  return hasPermission(userRole, section);
}

/**
 * Role display names for UI
 */
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  USER: 'User',
  QA: 'QA',
  CORE: 'Core',
  FLEET: 'Fleet',
  MANAGER: 'Fleet (Legacy)', // Show it's deprecated
  ADMIN: 'Admin',
};

/**
 * Role descriptions for UI
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  USER: 'Basic user access - Time Recording and Links',
  QA: 'Quality Assurance - User Tools + QA Dashboard',
  CORE: 'Core Operations - User + QA + Scoring and Review',
  FLEET: 'Fleet Management - User + QA + Core + Operations',
  MANAGER: 'Fleet Management (deprecated - use Fleet)',
  ADMIN: 'Full system access',
};
