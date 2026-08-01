import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { DEMO_HOST, DOCS_HOST, normalizeHostname } from '@/lib/public-surface-routing'
import { REQUEST_ID_HEADER, resolveRequestId } from '@/lib/observability/request-id'

export async function middleware(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
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
  // Identity context is application-owned. Never trust client-supplied values;
  // protected routes receive fresh headers only after Supabase verification.
  requestHeaders.delete('x-user-id')
  requestHeaders.delete('x-user-authenticated')
  requestHeaders.delete('x-auth-error')
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const host = normalizeHostname(request.headers.get('host'))
  // Keep the app service worker address stable even on rewritten public hosts.
  // Docs/demo clients do not register it, but stale registrations must not be
  // redirected to a nonexistent nested path.
  if (request.nextUrl.pathname === '/sw.js') {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }

  if (host === DOCS_HOST) {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/docs')) {
      url.pathname = url.pathname === '/' ? '/docs' : `/docs${url.pathname}`
    }
    const rewriteResponse = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    rewriteResponse.headers.set('Content-Security-Policy', csp)
    rewriteResponse.headers.set(REQUEST_ID_HEADER, requestId)
    return rewriteResponse
  }

  if (host === DEMO_HOST) {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/demo')) {
      url.pathname = url.pathname === '/' ? '/demo' : `/demo${url.pathname}`
    }
    const rewriteResponse = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    rewriteResponse.headers.set('Content-Security-Policy', csp)
    rewriteResponse.headers.set(REQUEST_ID_HEADER, requestId)
    return rewriteResponse
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })
  supabaseResponse.headers.set('Content-Security-Policy', csp)
  supabaseResponse.headers.set(REQUEST_ID_HEADER, requestId)

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  const { pathname } = request.nextUrl
  const isProtectedRoute = pathname.startsWith('/dashboard')

  // Public pages do not need a network round-trip to Supabase before rendering.
  // Their client auth providers still restore sessions where the UI needs them.
  if (!isProtectedRoute) {
    return supabaseResponse
  }

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
          supabaseResponse.headers.set(REQUEST_ID_HEADER, requestId)
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

  if (!user) {
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
    redirectResponse.headers.set(REQUEST_ID_HEADER, requestId)
    return redirectResponse
  }

  requestHeaders.set('x-user-id', user.id)
  requestHeaders.set('x-user-authenticated', 'authenticated')
  const authenticatedResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })
  authenticatedResponse.headers.set('Content-Security-Policy', csp)
  authenticatedResponse.headers.set(REQUEST_ID_HEADER, requestId)
  // Preserve any auth-cookie refresh performed by Supabase above.
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    authenticatedResponse.cookies.set(cookie)
  })
  return authenticatedResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
