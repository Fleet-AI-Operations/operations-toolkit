// Main entry point - CLIENT-SAFE EXPORTS ONLY
// For server-side imports, use @repo/auth/server

// Re-export client-side auth functions
export { createClient as createBrowserClient } from './client';

// Re-export app access control (client-safe utility functions)
export {
  hasAppAccess,
  getAppUrl,
  getDefaultAppForRole,
  getRedirectUrlIfNeeded,
  type AppName,
  type UserRole
} from './app-access';

// Note: Server-side functions are available via @repo/auth/server
// - createClient (server)
// - createAdminClient
// - getUserRole, getUserProfile, hasRole
