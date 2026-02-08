import { createBrowserClient } from '@supabase/ssr';
/**
 * Creates a Supabase client for browser/client-side use
 *
 * Environment Configuration:
 * - Local Dev: Uses .env.local with local Supabase (http://127.0.0.1:54321)
 * - Production: Uses Vercel environment variables with Supabase Cloud
 *
 * @returns Supabase client instance or null if configuration is missing
 */
export function createClient() {
    // IMPORTANT: Next.js requires STATIC property access (process.env.NAME)
    // for client-side variables to be correctly bundled.
    // Dynamic access like process.env[name] will FAIL in the browser.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/['"]/g, '');
    // Supports both modern publishable keys (sb_publishable_*) and legacy anon keys
    const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim()?.replace(/['"]/g, '');
    if (!supabaseUrl || !supabaseKey) {
        const errorMsg = 'Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY) are missing. ' +
            'For local dev, ensure .env.local exists. For production, add to Vercel Environment Variables.';
        console.error('[Supabase Client]', errorMsg);
        return null;
    }
    // Use validated variables instead of hardcoding to support both publishable and anon keys
    return createBrowserClient(supabaseUrl, supabaseKey);
}
