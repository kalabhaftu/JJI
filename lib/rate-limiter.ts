import logger from '@/lib/logger';
import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { isRedisConfigured, redis } from '@/lib/cache/client'
import { getClientIp } from '@/lib/security/client-ip'
import { ErrorResponses } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

// ─── Limiter config type ───
export interface LimiterConfig {
  points: number
  duration: number
  failClosed?: boolean
}

function shouldFailClosed(limiter: LimiterConfig) {
  return process.env.NODE_ENV === 'production' && limiter.failClosed === true
}

let backendUnavailableCount = 0
let lastBackendUnavailableReportAt = 0

function reportRateLimitBackendUnavailable(
  error: unknown,
  failClosed: boolean,
  requestId?: string,
) {
  logger.warn({ event: 'rate_limit_backend_unavailable', backend: {
    has_KV_URL: !!process.env.KV_REST_API_URL,
    has_UPSTASH_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    failClosed,
    NODE_ENV: process.env.NODE_ENV,
  } }, '[Rate Limiter] Backend unavailable')

  backendUnavailableCount += 1
  const now = Date.now()
  const shouldCapture = backendUnavailableCount === 1
    || (
      backendUnavailableCount % 10 === 0
      && now - lastBackendUnavailableReportAt >= 60_000
    )
  if (shouldCapture) {
    lastBackendUnavailableReportAt = now
    reportError(error, {
      surface: 'api',
      operation: 'rate-limit-backend',
      ...(requestId ? { requestId } : {}),
      extra: {
        failClosed,
        redisConfigured: isRedisConfigured(),
        unavailableCount: backendUnavailableCount,
      },
    })
  }
}

async function rateLimitUnavailableResponse(requestId: string) {
  return ErrorResponses.rateLimitUnavailable(requestId)
}

function backendUnavailableError(cause?: unknown) {
  return new Error('Rate-limit backend unavailable', {
    ...(cause !== undefined ? { cause } : {}),
  })
}

function handleUnavailableLimiter(
  limiter: LimiterConfig,
  requestId?: string,
  cause?: unknown,
) {
  const failClosed = shouldFailClosed(limiter)
  reportRateLimitBackendUnavailable(
    backendUnavailableError(cause),
    failClosed,
    requestId,
  )
  return {
    failClosed,
    remaining: failClosed ? 0 : limiter.points,
  }
}

function rateLimitHeaders(
  limit: number,
  remaining: number,
  reset: number,
  retryAfter: number,
) {
  return {
    'Retry-After': String(retryAfter),
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  }
}

// @upstash/ratelimit uses this only to suppress duplicate requests within one
// process. It is not a production fallback limiter.
const ephemeralCache = new Map()

// ─── Upstash Limiter Instances ───
const ratelimiterInstances = new Map<string, Ratelimit>()
const UPSTASH_TIMEOUT_MS = 1_500

function getUpstashLimiter(config: LimiterConfig): Ratelimit {
  const cacheKey = `${config.points}:${config.duration}`
  let limiter = ratelimiterInstances.get(cacheKey)
  
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.points, `${config.duration} s`),
      ephemeralCache: ephemeralCache,
      analytics: false,
      timeout: UPSTASH_TIMEOUT_MS,
    })
    ratelimiterInstances.set(cacheKey, limiter)
  }
  return limiter
}

function isUpstashTimeout(result: unknown): boolean {
  return Boolean(
    result
    && typeof result === 'object'
    && 'reason' in result
    && (result as { reason?: unknown }).reason === 'timeout'
  )
}

async function consumeUpstashLimit(
  key: string,
  limiter: LimiterConfig,
  requestId?: string,
) {
  const result = await getUpstashLimiter(limiter).limit(key)
  // Upstash intentionally returns success after its timeout. Sensitive JJI
  // policies must convert that result back into the configured fail-closed
  // decision instead of silently bypassing enforcement.
  if (isUpstashTimeout(result)) {
    return {
      unavailable: handleUnavailableLimiter(
        limiter,
        requestId,
        new Error(`Upstash rate-limit request exceeded ${UPSTASH_TIMEOUT_MS}ms`),
      ),
      result: null,
    }
  }
  backendUnavailableCount = 0
  return { unavailable: null, result }
}

// ─── Exported limiter configs (drop-in compatible with existing imports) ───
export const apiLimiter: LimiterConfig = { points: 100, duration: 60, failClosed: true }
export const authenticatedReadLimiter: LimiterConfig = { points: 100, duration: 60 }
export const sensitiveMutationLimiter: LimiterConfig = { points: 60, duration: 60, failClosed: true }
export const authLimiter: LimiterConfig = { points: 10, duration: 60, failClosed: true }
export const aiLimiter: LimiterConfig = { points: 20, duration: 60, failClosed: true }
export const aiReviewLimiter: LimiterConfig = { points: 1, duration: 86400, failClosed: true }
export const importLimiter: LimiterConfig = { points: 10, duration: 60, failClosed: true }
export const uploadLimiter: LimiterConfig = { points: 30, duration: 60, failClosed: true }
export const webhookLimiter: LimiterConfig = { points: 20, duration: 60, failClosed: true }
export const thorLimiter: LimiterConfig = { points: 20, duration: 60, failClosed: true }
export const paymentLimiter: LimiterConfig = { points: 30, duration: 60, failClosed: true }
export const feedbackLimiter: LimiterConfig = { points: 5, duration: 60, failClosed: true }
export const adminLimiter: LimiterConfig = { points: 200, duration: 60, failClosed: true }
export const publicLimiter: LimiterConfig = { points: 30, duration: 60 }
export const errorReportLimiter: LimiterConfig = { points: 10, duration: 60, failClosed: true }
export const emailOtpLimiter: LimiterConfig = { points: 3, duration: 3600, failClosed: true }

/**
 * Get identifier for rate limiting.
 * Uses user ID if available, falls back to IP.
 */
async function getRateLimitIdentifier(req: NextRequest): Promise<string> {
  try {
    // Resolve the canonical internal identity only for authenticated requests.
    // Dynamic import avoids a module cycle: server/auth imports this limiter.
    const { getResolvedUserIdentitySafe } = await import('@/server/user-identity')
    const identity = await getResolvedUserIdentitySafe()
    if (identity?.internalUserId) {
      return `rate-limit:user:${identity.internalUserId}`
    }
  } catch (error) {
    logger.warn({ error }, 'Unable to resolve authenticated rate-limit identity; using IP fallback')
  }

  return `rate-limit:ip:${getClientIp(req.headers)}`
}

export function getEmailRateLimitKey(email: string) {
  const normalized = email.trim().toLowerCase()
  const hash = createHash('sha256').update(normalized).digest('hex')
  return `rate-limit:email-otp:${hash}`
}

export async function consumeRateLimitKey(
  key: string,
  limiter: LimiterConfig
): Promise<{ allowed: boolean; remaining: number }> {
  if (!isRedisConfigured()) {
    const unavailable = handleUnavailableLimiter(limiter)
    return {
      allowed: !unavailable.failClosed,
      remaining: unavailable.remaining,
    }
  }

  try {
    const outcome = await consumeUpstashLimit(key, limiter)
    if (outcome.unavailable) {
      return {
        allowed: !outcome.unavailable.failClosed,
        remaining: outcome.unavailable.remaining,
      }
    }
    const { success, remaining } = outcome.result!
    return { allowed: success, remaining }
  } catch (error) {
    const unavailable = handleUnavailableLimiter(limiter, undefined, error)
    return {
      allowed: !unavailable.failClosed,
      remaining: unavailable.remaining,
    }
  }
}

/**
 * Apply rate limiting to a request.
 * Returns null if allowed, or a 429/503 response when enforcement blocks.
 *
 * Uses @upstash/ratelimit for distributed rate limiting.
 */
export async function applyRateLimit(
  req: NextRequest,
  limiter: LimiterConfig = apiLimiter
): Promise<NextResponse | null> {
  const requestId = resolveRequestId(req.headers)
  const identifier = await getRateLimitIdentifier(req)

  if (!isRedisConfigured()) {
    const unavailable = handleUnavailableLimiter(limiter, requestId)
    if (unavailable.failClosed) {
      return rateLimitUnavailableResponse(requestId)
    }
    return null
  }

  try {
    const outcome = await consumeUpstashLimit(identifier, limiter, requestId)
    if (outcome.unavailable) {
      return outcome.unavailable.failClosed
        ? rateLimitUnavailableResponse(requestId)
        : null
    }
    const { success, limit, remaining, reset } = outcome.result!

    if (!success) {
      return ErrorResponses.rateLimited(
        requestId,
        limiter.duration,
        rateLimitHeaders(limit, remaining, reset, limiter.duration),
      )
    }

    return null
  } catch (error) {
    const unavailable = handleUnavailableLimiter(limiter, requestId, error)
    if (unavailable.failClosed) {
      return rateLimitUnavailableResponse(requestId)
    }
    return null
  }
}

/**
 * Wrapper for API route handlers with rate limiting.
 */
function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  limiter: LimiterConfig = apiLimiter
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const rateLimitResponse = await applyRateLimit(req, limiter)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    return handler(req)
  }
}
