
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
export async function createClient() {
    const cookieStore = await cookies()

    // Unified environment variable extraction
    // Supports both server-side (SUPABASE_*) and public (NEXT_PUBLIC_*) variables
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim()?.replace(/['"]/g, '')

    // Supports modern publishable keys and legacy anon keys
    const supabaseKey = (process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim()?.replace(/['"]/g, '')

    if (!supabaseUrl || !supabaseKey) {
        const errorMsg = `Supabase configuration missing (URL: ${supabaseUrl ? 'Set' : 'MISSING'}, Key: ${supabaseKey ? 'Set' : 'MISSING'}).`
        throw new Error(errorMsg)
    }

    return createServerClient(
        supabaseUrl!,
        supabaseKey!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

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
export async function createAdminClient() {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim()?.replace(/['"]/g, '')
    const supabaseServiceKey = (
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY
    )?.trim()?.replace(/['"]/g, '')

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase Admin config missing (SUPABASE_SERVICE_ROLE_KEY). ' +
            'For local dev, ensure .env.local exists. For production, add to Vercel Environment Variables.')
    }

    // Diagnostic check: Ensure we have a service role key, not an anon/publishable key
    if (supabaseServiceKey.includes('anon') || supabaseServiceKey.includes('publishable')) {
        console.warn('[Supabase Admin] The provided key appears to be an ANON/PUBLISHABLE key, not a SERVICE ROLE key. ' +
            'Admin operations will likely fail. Check your environment variables.')
    }

    return createServerClient(
        supabaseUrl,
        supabaseServiceKey,
        {
            cookies: {
                getAll() { return [] },
                setAll() { },
            },
        }
    )
}
