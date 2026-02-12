import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Authentication Proxy
 *
 * Handles authentication and authorization for all routes:
 * - Redirects unauthenticated users to /login
 * - Forces password reset when mustResetPassword is true
 * - Refreshes Supabase session on each request
 *
 * Environment Configuration:
 * - Local Dev: Uses .env.local with local Supabase
 * - Production: Uses Vercel environment variables with Supabase Cloud
 * - Tests: Uses .env.test with local Supabase
 */
export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // Unified environment variable extraction
    // Supports both server-side and public environment variables
    const supabaseUrl = (process.env.SUPABASE_URL ||
                         process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/['"]/g, '')
    const supabaseKey = (process.env.SUPABASE_PUBLISHABLE_KEY ||
                        process.env.SUPABASE_ANON_KEY ||
                        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.replace(/['"]/g, '')

    if (!supabaseUrl || !supabaseKey) {
        if (request.nextUrl.pathname !== '/favicon.ico' && !request.nextUrl.pathname.startsWith('/_next')) {
            console.warn('[Proxy] Supabase config missing or invalid. URL:', supabaseUrl ? 'Set' : 'MISSING', 'Key:', supabaseKey ? 'Set' : 'MISSING')
        }
        return supabaseResponse
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // getUser(). A simple mistake could make it very hard to debug issues
    // related to the proxy refreshing the user's session.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (process.env.NODE_ENV === 'development') {
        console.log('[Proxy]', request.nextUrl.pathname, '- User:', user ? user.email : 'none')
    }

    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        !request.nextUrl.pathname.startsWith('/status')
    ) {
        // no user, redirect to login page
        console.log('[Proxy] No user found, redirecting to /login from', request.nextUrl.pathname)
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        const response = NextResponse.redirect(url)
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
        return response
    }

    if (user) {
        // Check for password reset requirement
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, mustResetPassword')
            .eq('id', user.id)
            .single() as any

        if (profileError) {
            console.error(`[Proxy] Profile fetch error for ${user.id}:`, profileError.message)
        }

        if (profile?.mustResetPassword && !request.nextUrl.pathname.startsWith('/auth/reset-password') && !request.nextUrl.pathname.startsWith('/auth/callback')) {
            const url = request.nextUrl.clone()
            url.pathname = '/auth/reset-password'
            const response = NextResponse.redirect(url)
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
            return response
        }
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api (API routes - they handle their own auth)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
