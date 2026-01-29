
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    // Support Vercel deployment env vars with multiple fallback names
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/['"]/g, '')
    const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.replace(/['"]/g, '')

    if (typeof window !== 'undefined') {
        console.log('[Supabase Client] Initializing with URL:', supabaseUrl ? 'Set' : 'MISSING')
        console.log('[Supabase Client] Initializing with Key:', supabaseKey ? 'Set' : 'MISSING')
    }

    if (!supabaseUrl || !supabaseKey) {
        const errorMsg = 'Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Check your environment variables.'
        console.error('[Supabase Client]', errorMsg)
        throw new Error(errorMsg)
    }

    return createBrowserClient(
        supabaseUrl,
        supabaseKey
    )
}
