import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { DEMO_HOST, DOCS_HOST, normalizeHostname } from '@/lib/public-surface-routing'
import { REQUEST_ID_HEADER, resolveRequestId } from '@/lib/observability/request-id'

type AuthClaims = {
  sub?: string
}

export async function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const nonce = btoa(crypto.randomUUID())
  const isDevelopment = process.env.NODE_ENV === 'development'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com${isDevelopment ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://cdn.discordapp.com",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://api.vercel.com https://vitals.vercel-insights.com https://*.vercel-insights.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!isDevelopment ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
  const requestHeaders = new Headers(request.headers)

  requestHeaders.delete('x-user-id')
  requestHeaders.delete('x-user-authenticated')
  requestHeaders.delete('x-auth-error')
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const applySecurityHeaders = (response: NextResponse) => {
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }

  const host = normalizeHostname(request.headers.get('host'))
  const pathname = request.nextUrl.pathname

  if (pathname === '/sw.js') {
    return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }))
  }

  if (host === DOCS_HOST) {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/docs')) {
      url.pathname = url.pathname === '/' ? '/docs' : `/docs${url.pathname}`
    }
    return applySecurityHeaders(NextResponse.rewrite(url, { request: { headers: requestHeaders } }))
  }

  if (host === DEMO_HOST) {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/demo')) {
      url.pathname = url.pathname === '/' ? '/demo' : `/demo${url.pathname}`
    }
    return applySecurityHeaders(NextResponse.rewrite(url, { request: { headers: requestHeaders } }))
  }

  let supabaseResponse = applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
  )
  const isApiRoute = pathname.startsWith('/api/')
  const isProtectedRoute = pathname.startsWith('/dashboard')

  if (!isApiRoute && !isProtectedRoute) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          requestHeaders.set('cookie', request.cookies.toString())
          supabaseResponse = applySecurityHeaders(
            NextResponse.next({ request: { headers: requestHeaders } }),
          )
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  let claims: AuthClaims | null = null
  try {
    const result = await supabase.auth.getClaims()
    claims = (result.data?.claims as AuthClaims | null | undefined) ?? null
  } catch {
    claims = null
  }

  const userId = typeof claims?.sub === 'string' ? claims.sub : null
  if (userId) {
    requestHeaders.set('x-user-id', userId)
    requestHeaders.set('x-user-authenticated', 'authenticated')
  }

  const createForwardResponse = () => {
    const response = applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    )
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  if (isApiRoute) {
    return createForwardResponse()
  }

  if (!userId) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'

    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    return applySecurityHeaders(redirectResponse)
  }

  return createForwardResponse()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
