import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { DEMO_HOST, DOCS_HOST, normalizeHostname } from '@/lib/public-surface-routing'

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const isDevelopment = process.env.NODE_ENV === 'development'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://vitals.vercel-insights.com https://*.vercel-insights.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!isDevelopment ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const host = normalizeHostname(request.headers.get('host'))
  if (host === DOCS_HOST) {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/docs')) {
      url.pathname = url.pathname === '/' ? '/docs' : `/docs${url.pathname}`
    }
    const rewriteResponse = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    rewriteResponse.headers.set('Content-Security-Policy', csp)
    return rewriteResponse
  }

  if (host === DEMO_HOST) {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/demo')) {
      url.pathname = url.pathname === '/' ? '/demo' : `/demo${url.pathname}`
    }
    const rewriteResponse = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    rewriteResponse.headers.set('Content-Security-Policy', csp)
    return rewriteResponse
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })
  supabaseResponse.headers.set('Content-Security-Policy', csp)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          supabaseResponse.headers.set('Content-Security-Policy', csp)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do NOT write any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protected routes - redirect unauthenticated users to /login
  const isProtectedRoute =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin')

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // IMPORTANT: carry forward the refreshed auth cookies so Supabase
    // can re-validate on the /login page and avoid a double-redirect.
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    redirectResponse.headers.set('Content-Security-Policy', csp)
    return redirectResponse
  }

  // Auth routes - redirect authenticated users away from /login or /signup
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    redirectResponse.headers.set('Content-Security-Policy', csp)
    return redirectResponse
  }

  // IMPORTANT: return supabaseResponse (not NextResponse.next()) to ensure
  // the session cookies updated by getUser() are written to the browser.
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handled server-side, no session needed at edge)
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
