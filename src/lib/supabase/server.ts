
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    // Support Vercel deployment env vars with multiple fallback names
    const supabaseUrl = (process.env.SUPABASE_URL || 
                         process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/['"]/g, '')
    
    const supabaseKey = (process.env.SUPABASE_PUBLISHABLE_KEY ||
                        process.env.SUPABASE_ANON_KEY ||
                        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.replace(/['"]/g, '')

    console.log('[Supabase Server] Initializing with URL:', supabaseUrl ? 'Set' : 'MISSING')
    console.log('[Supabase Server] Initializing with Key:', supabaseKey ? 'Set' : 'MISSING')

    if (!supabaseUrl || !supabaseKey) {
        const errorMsg = 'Error: Supabase project URL or Key is missing. Check your environment variables.'
        console.error('[Supabase Server]', errorMsg)
        // Instead of letting Supabase throw a generic error, we throw a specific one
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
