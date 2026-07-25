import logger from '@/lib/logger';
import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { isRedisConfigured, redis } from '@/lib/cache/client'
import { getClientIp } from '@/lib/security/client-ip'

// ─── Limiter config type ───
export interface LimiterConfig {
  points: number
  duration: number
  failClosed?: boolean
}

function allowInMemoryProductionLimits() {
  return process.env.ALLOW_IN_MEMORY_RATE_LIMITS_IN_PRODUCTION === 'true' || process.env.ALLOW_IN_MEMORY_RATE_LIMITS_IN_PRODUCTION === '1'
}

function shouldFailClosed(limiter: LimiterConfig) {
  return process.env.NODE_ENV === 'production' && limiter.failClosed && !allowInMemoryProductionLimits()
}

function rateLimitUnavailableResponse() {
  logger.error({ event: 'system_error', error: {
    has_KV_URL: !!process.env.KV_REST_API_URL,
    has_UPSTASH_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    ALLOW_IN_MEMORY: process.env.ALLOW_IN_MEMORY_RATE_LIMITS_IN_PRODUCTION,
    NODE_ENV: process.env.NODE_ENV
  } }, '[Rate Limiter] Fail-closed triggered. Environment variables status:')
  return NextResponse.json(
    {
      success: false,
      error: 'Service temporarily unavailable',
      code: 'RATE_LIMIT_BACKEND_UNAVAILABLE',
      retryable: true,
    },
    { status: 503 }
  )
}

// ─── Ephemeral Cache (Memory Fallback for @upstash/ratelimit) ───
const ephemeralCache = new Map()

// ─── Upstash Limiter Instances ───
const ratelimiterInstances = new Map<string, Ratelimit>()

function getUpstashLimiter(config: LimiterConfig): Ratelimit {
  const cacheKey = `${config.points}:${config.duration}`
  let limiter = ratelimiterInstances.get(cacheKey)
  
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.points, `${config.duration} s`),
      ephemeralCache: ephemeralCache,
      analytics: false,
    })
    ratelimiterInstances.set(cacheKey, limiter)
  }
  return limiter
}

// ─── Exported limiter configs (drop-in compatible with existing imports) ───
export const apiLimiter: LimiterConfig = { points: 100, duration: 60 }
const authLimiter: LimiterConfig = { points: 10, duration: 60, failClosed: true }
export const aiLimiter: LimiterConfig = { points: 20, duration: 60, failClosed: true }
export const aiReviewLimiter: LimiterConfig = { points: 1, duration: 86400 }
export const importLimiter: LimiterConfig = { points: 10, duration: 60 }
const uploadLimiter: LimiterConfig = { points: 30, duration: 60 }
export const webhookLimiter: LimiterConfig = { points: 20, duration: 60, failClosed: true }
export const thorLimiter: LimiterConfig = { points: 20, duration: 60, failClosed: true }
const paymentLimiter: LimiterConfig = { points: 30, duration: 60, failClosed: true }
export const feedbackLimiter: LimiterConfig = { points: 5, duration: 60 }
const adminLimiter: LimiterConfig = { points: 200, duration: 60, failClosed: true }
export const publicLimiter: LimiterConfig = { points: 30, duration: 60 }
export const errorReportLimiter: LimiterConfig = { points: 10, duration: 60, failClosed: true }
export const emailOtpLimiter: LimiterConfig = { points: 3, duration: 3600, failClosed: true }

/**
 * Get identifier for rate limiting.
 * Uses user ID if available, falls back to IP.
 */
function getRateLimitIdentifier(req: NextRequest): string {
  return `ip:${getClientIp(req.headers)}`
}

export function getEmailRateLimitKey(email: string) {
  const normalized = email.trim().toLowerCase()
  const hash = createHash('sha256').update(normalized).digest('hex')
  return `email-otp:${hash}`
}

export async function consumeRateLimitKey(
  key: string,
  limiter: LimiterConfig
): Promise<{ allowed: boolean; remaining: number }> {
  if (!isRedisConfigured()) {
    if (shouldFailClosed(limiter)) {
      return { allowed: false, remaining: 0 }
    }
    return { allowed: true, remaining: limiter.points }
  }

  try {
    const upstashLimiter = getUpstashLimiter(limiter)
    const { success, remaining } = await upstashLimiter.limit(key)
    return { allowed: success, remaining }
  } catch (error) {
    // Fail-open if Redis error and not failClosed
    if (shouldFailClosed(limiter)) {
      return { allowed: false, remaining: 0 }
    }
    return { allowed: true, remaining: limiter.points }
  }
}

/**
 * Apply rate limiting to a request.
 * Returns null if allowed, or a 429 response if rate limited.
 *
 * Uses @upstash/ratelimit for distributed rate limiting.
 */
export async function applyRateLimit(
  req: NextRequest,
  limiter: LimiterConfig = apiLimiter
): Promise<NextResponse | null> {
  const identifier = getRateLimitIdentifier(req)

  if (!isRedisConfigured()) {
    if (shouldFailClosed(limiter)) {
      return rateLimitUnavailableResponse()
    }
    return null
  }

  try {
    const upstashLimiter = getUpstashLimiter(limiter)
    const { success, limit, remaining, reset } = await upstashLimiter.limit(identifier)

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests',
          details: 'Please wait a moment before trying again',
          code: 'RATE_LIMIT_EXCEEDED',
          retryable: true,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(limiter.duration),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        }
      )
    }

    return null
  } catch (error) {
    // Log error but fail-open unless explicitly fail-closed
    logger.warn({ error }, 'Rate limiter error, falling back to open limit')
    if (shouldFailClosed(limiter)) {
      return rateLimitUnavailableResponse()
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
