/**
 * Creates a Supabase client for browser/client-side use
 *
 * Environment Configuration:
 * - Local Dev: Uses .env.local with local Supabase (http://127.0.0.1:54321)
 * - Production: Uses Vercel environment variables with Supabase Cloud
 *
 * @returns Supabase client instance or null if configuration is missing
 */
export declare function createClient(): import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any> | null;
//# sourceMappingURL=client.d.ts.map