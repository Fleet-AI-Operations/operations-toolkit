import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // Exhaustive log of ALL environment variable keys to see what Vercel is actually passing to the Edge Runtime
    const allKeys = Object.keys(process.env).sort()
    if (request.nextUrl.pathname !== '/favicon.ico' && !request.nextUrl.pathname.startsWith('/_next')) {
        console.log('[Middleware] Total env keys:', allKeys.length)
        console.log('[Middleware] Environment Fingerprint:', {
            isVercel: !!process.env.VERCEL,
            nodeEnv: process.env.NODE_ENV,
        })
        console.log('[Middleware] Supabase/Next Any Case Search:', allKeys.filter(k => k.toLowerCase().includes('supabase') || k.toLowerCase().includes('next_public')).join(', '))
        console.log('[Middleware] Other Auth/Key Search:', allKeys.filter(k => k.toLowerCase().includes('auth') || k.toLowerCase().includes('api') || k.toLowerCase().includes('secret')).join(', '))
    }

    // Unified environment variable extraction
    const supabaseUrl = (process.env.SUPABASE_URL || 
                         process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/['"]/g, '')
    const supabaseKey = (process.env.SUPABASE_PUBLISHABLE_KEY ||
                        process.env.SUPABASE_ANON_KEY ||
                        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.replace(/['"]/g, '')

    if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith('http')) {
        // Only log warning if we are actually missing them, to avoid spamming logs
        if (request.nextUrl.pathname !== '/favicon.ico') {
            console.warn('[Middleware] Supabase config missing or invalid. URL:', supabaseUrl ? 'Set' : 'MISSING', 'Key:', supabaseKey ? 'Set' : 'MISSING')
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
    // getUser(). A simple mistake could make it very hard to debug
    // if you're oblivious to the middleware refreshing the user's session.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        request.nextUrl.pathname !== '/'
    ) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
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
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
