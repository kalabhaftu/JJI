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

  const host = normalizeHostname(request.headers.get('host'))


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


  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'


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

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    authenticatedResponse.cookies.set(cookie)
  })
  return authenticatedResponse
}

export const config = {
  matcher: [


    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
