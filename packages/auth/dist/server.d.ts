/**
 * Creates a Supabase client for server-side use (API routes, server components)
 *
 * Environment Configuration:
 * - Local Dev: Uses .env.local with local Supabase (http://127.0.0.1:54321)
 * - Production: Uses Vercel environment variables with Supabase Cloud
 * - Tests: Uses .env.test with local Supabase
 *
 * @returns Server-side Supabase client with cookie-based auth
 */
export declare function createClient(): Promise<import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>>;
/**
 * ADMIN CLIENT: Creates a Supabase client with Service Role Key to bypass RLS
 *
 * ⚠️ WARNING: NEVER use this on the client side or expose the service role key!
 *
 * Use Cases:
 * - Admin operations that need to bypass Row Level Security
 * - User management (creating/updating users)
 * - System-level database operations
 *
 * Environment Configuration:
 * - Local Dev: Uses .env.local with local Supabase service role key
 * - Production: Uses Vercel environment variables with Supabase Cloud service role key
 * - Docker: Uses .env.docker with mock service role key
 *
 * @returns Admin Supabase client with full database access
 */
export declare function createAdminClient(): Promise<import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>>;
//# sourceMappingURL=server.d.ts.map