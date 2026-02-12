/**
 * App Access Control and Role-Based Redirects
 *
 * Determines which app a user should be on based on their role,
 * and provides redirect URLs for cross-app navigation.
 */

export type AppName = 'user' | 'qa' | 'core' | 'fleet' | 'admin';
export type UserRole = 'PENDING' | 'USER' | 'QA' | 'CORE' | 'FLEET' | 'MANAGER' | 'ADMIN';

interface AppConfig {
  name: AppName;
  displayName: string;
  requiredRole: UserRole;
  urlEnvVar: string;
  localUrl: string;
}

const APP_CONFIGS: AppConfig[] = [
  {
    name: 'user',
    displayName: 'User App',
    requiredRole: 'USER',
    urlEnvVar: 'NEXT_PUBLIC_USER_APP_URL',
    localUrl: 'http://localhost:3001'
  },
  {
    name: 'qa',
    displayName: 'QA App',
    requiredRole: 'QA',
    urlEnvVar: 'NEXT_PUBLIC_QA_APP_URL',
    localUrl: 'http://localhost:3002'
  },
  {
    name: 'core',
    displayName: 'Core App',
    requiredRole: 'CORE',
    urlEnvVar: 'NEXT_PUBLIC_CORE_APP_URL',
    localUrl: 'http://localhost:3003'
  },
  {
    name: 'fleet',
    displayName: 'Fleet App',
    requiredRole: 'FLEET',
    urlEnvVar: 'NEXT_PUBLIC_FLEET_APP_URL',
    localUrl: 'http://localhost:3004'
  },
  {
    name: 'admin',
    displayName: 'Admin App',
    requiredRole: 'ADMIN',
    urlEnvVar: 'NEXT_PUBLIC_ADMIN_APP_URL',
    localUrl: 'http://localhost:3005'
  }
];

/**
 * Role hierarchy weights for permission checks
 */
const ROLE_WEIGHTS: Record<UserRole, number> = {
  PENDING: 0,
  USER: 1,
  QA: 2,
  CORE: 3,
  FLEET: 4,
  MANAGER: 5, // Legacy role, same level as ADMIN
  ADMIN: 5
};

/**
 * Check if a user's role has access to a specific app
 */
export function hasAppAccess(userRole: UserRole, appName: AppName): boolean {
  const appConfig = APP_CONFIGS.find(config => config.name === appName);
  if (!appConfig) return false;

  const userWeight = ROLE_WEIGHTS[userRole] ?? 0;
  const requiredWeight = ROLE_WEIGHTS[appConfig.requiredRole] ?? 0;

  return userWeight >= requiredWeight;
}

/**
 * Get the URL for a specific app (production or local)
 *
 * IMPORTANT: Uses static property access for Next.js bundler compatibility.
 * The bundler replaces process.env.NEXT_PUBLIC_* at build time.
 */
export function getAppUrl(appName: AppName): string {
  // Static lookup map for Next.js bundler to properly replace env vars
  const prodUrls: Record<AppName, string | undefined> = {
    user: process.env.NEXT_PUBLIC_USER_APP_URL,
    qa: process.env.NEXT_PUBLIC_QA_APP_URL,
    core: process.env.NEXT_PUBLIC_CORE_APP_URL,
    fleet: process.env.NEXT_PUBLIC_FLEET_APP_URL,
    admin: process.env.NEXT_PUBLIC_ADMIN_APP_URL,
  };

  const localUrls: Record<AppName, string> = {
    user: 'http://localhost:3001',
    qa: 'http://localhost:3002',
    core: 'http://localhost:3003',
    fleet: 'http://localhost:3004',
    admin: 'http://localhost:3005',
  };

  return prodUrls[appName] || localUrls[appName] || '/';
}

/**
 * Get the highest-privilege app that a user has access to
 */
export function getDefaultAppForRole(userRole: UserRole): AppName {
  // PENDING users have no app access - they should see a pending approval page
  if (userRole === 'PENDING') {
    return 'user'; // User app should show a "pending approval" message
  }

  const userWeight = ROLE_WEIGHTS[userRole] ?? 0;

  // Find the highest-privilege app the user can access
  // Start from highest to lowest
  const sortedApps = [...APP_CONFIGS].sort(
    (a, b) => ROLE_WEIGHTS[b.requiredRole] - ROLE_WEIGHTS[a.requiredRole]
  );

  for (const app of sortedApps) {
    const requiredWeight = ROLE_WEIGHTS[app.requiredRole];
    if (userWeight >= requiredWeight) {
      return app.name;
    }
  }

  // Fallback to user app (should not reach here for valid roles)
  return 'user';
}

/**
 * Get redirect URL if user doesn't have access to current app
 * Returns null if user has access to current app
 */
export function getRedirectUrlIfNeeded(
  userRole: UserRole,
  currentApp: AppName
): string | null {
  // Check if user has access to current app
  if (hasAppAccess(userRole, currentApp)) {
    return null; // No redirect needed
  }

  // User doesn't have access, redirect to their default app
  const targetApp = getDefaultAppForRole(userRole);
  return getAppUrl(targetApp);
}
