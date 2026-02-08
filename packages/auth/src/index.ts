// Re-export server-side auth functions
export { createClient as createServerClient, createAdminClient } from './server';

// Re-export client-side auth functions
export { createClient as createBrowserClient } from './client';

// Re-export auth utilities
export { getUserRole, getUserProfile, hasRole } from './utils';
