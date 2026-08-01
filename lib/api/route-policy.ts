import type { NextRequest, NextResponse } from 'next/server'

import {
  adminLimiter,
  aiLimiter,
  applyRateLimit,
  authenticatedReadLimiter,
  authLimiter,
  errorReportLimiter,
  feedbackLimiter,
  importLimiter,
  paymentLimiter,
  publicLimiter,
  sensitiveMutationLimiter,
  type LimiterConfig,
  uploadLimiter,
} from '@/lib/rate-limiter'

export type ApiRoutePolicy =
  | 'trusted-signed'
  | 'sensitive'
  | 'authenticated-read'
  | 'public-read'
  | 'auth'
  | 'ai'
  | 'import'
  | 'payment'
  | 'upload'
  | 'feedback'
  | 'error-report'
  | 'admin'

const TRUSTED_PREFIXES = [
  '/api/cron/',
  '/api/inngest/',
  '/api/health',
] as const

const SIGNED_WEBHOOK_PATHS = new Set([
  '/api/v1/payments/webhook',
  '/api/v1/payments/whop-webhook',
  '/api/v1/import/webhook/tradingview',
])

const PUBLIC_READ_PREFIXES = [
  '/api/health',
  '/api/v1/reports/shared/',
  '/api/v1/prop-firm-templates',
] as const

const SENSITIVE_READ_PATHS = new Set([
  '/api/v1/data/export',
  '/api/v1/user/data/backup',
])

function startsWithAny(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix))
}

export function classifyApiRoute(
  pathname: string,
  method: string,
): ApiRoutePolicy {
  const normalizedMethod = method.toUpperCase()
  if (
    startsWithAny(pathname, TRUSTED_PREFIXES)
    || SIGNED_WEBHOOK_PATHS.has(pathname)
  ) {
    return 'trusted-signed'
  }
  if (pathname.startsWith('/api/admin/')) return 'admin'
  if (pathname.startsWith('/api/auth/')) return 'auth'
  if (pathname.startsWith('/api/v1/ai/')) return 'ai'
  if (
    pathname.startsWith('/api/v1/import/')
    || pathname.startsWith('/api/v1/data/import/')
    || pathname.startsWith('/api/v1/trades/import/')
  ) {
    return 'import'
  }
  if (pathname.startsWith('/api/v1/payments/')) return 'payment'
  if (pathname === '/api/v1/feedback') return 'feedback'
  if (pathname === '/api/v1/errors') return 'error-report'
  if (pathname.includes('/upload')) return 'upload'
  if (SENSITIVE_READ_PATHS.has(pathname)) return 'sensitive'
  if (
    normalizedMethod === 'GET'
    || normalizedMethod === 'HEAD'
    || normalizedMethod === 'OPTIONS'
  ) {
    return startsWithAny(pathname, PUBLIC_READ_PREFIXES)
      ? 'public-read'
      : 'authenticated-read'
  }
  return 'sensitive'
}

function limiterForPolicy(policy: ApiRoutePolicy): LimiterConfig | null {
  switch (policy) {
    case 'trusted-signed':
      return null
    case 'auth':
      return authLimiter
    case 'ai':
      return aiLimiter
    case 'import':
      return importLimiter
    case 'payment':
      return paymentLimiter
    case 'upload':
      return uploadLimiter
    case 'feedback':
      return feedbackLimiter
    case 'error-report':
      return errorReportLimiter
    case 'admin':
      return adminLimiter
    case 'public-read':
      return publicLimiter
    case 'authenticated-read':
      return authenticatedReadLimiter
    case 'sensitive':
      return sensitiveMutationLimiter
  }
}

export async function applyApiRoutePolicy(
  request: NextRequest,
  explicitPolicy?: ApiRoutePolicy,
): Promise<NextResponse | null> {
  const policy = explicitPolicy ?? classifyApiRoute(
    request.nextUrl.pathname,
    request.method,
  )
  const limiter = limiterForPolicy(policy)
  return limiter ? applyRateLimit(request, limiter) : null
}

export function withApiRoutePolicy<TContext = unknown>(
  handler: (
    request: NextRequest,
    context: TContext,
  ) => Promise<NextResponse>,
  policy?: ApiRoutePolicy,
) {
  return async (
    request: NextRequest,
    context: TContext,
  ): Promise<NextResponse> => {
    const limited = await applyApiRoutePolicy(request, policy)
    return limited ?? handler(request, context)
  }
}
