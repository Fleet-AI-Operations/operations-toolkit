import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware to handle cross-app SSO via token passing
 *
 * Flow:
 * 1. Check if URL has ?sso_token=xxx parameter
 * 2. If yes, exchange token for session
 * 3. Set session cookies
 * 4. Redirect to same URL without token
 * 5. If no token, refresh existing session (standard Supabase SSR pattern)
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Check for SSO tokens in URL
  const url = new URL(request.url);
  const ssoAccessToken = url.searchParams.get('sso_access_token');
  const ssoRefreshToken = url.searchParams.get('sso_refresh_token');

  if (ssoAccessToken && ssoRefreshToken) {
    // Exchange tokens for session
    const { error } = await supabase.auth.setSession({
      access_token: ssoAccessToken,
      refresh_token: ssoRefreshToken,
    });

    if (error) {
      console.error('[SSO] Failed to exchange tokens:', error.message);
    }

    // Remove tokens from URL and redirect
    url.searchParams.delete('sso_access_token');
    url.searchParams.delete('sso_refresh_token');
    return NextResponse.redirect(url);
  }

  // Standard session refresh for authenticated routes
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
