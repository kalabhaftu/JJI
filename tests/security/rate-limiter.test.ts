import { afterEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
  vi.resetModules()
})

describe('rate limiter production posture', () => {
  it('fails closed for sensitive limiters in production without KV', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    delete process.env.ALLOW_IN_MEMORY_RATE_LIMITS_IN_PRODUCTION

    const { consumeRateLimitKey, emailOtpLimiter } = await import('@/lib/rate-limiter')
    const result = await consumeRateLimitKey('rate-limit:email-otp:test', emailOtpLimiter)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('allows in-memory fallback in development', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN

    const { consumeRateLimitKey, emailOtpLimiter } = await import('@/lib/rate-limiter')
    const result = await consumeRateLimitKey(`rate-limit:email-otp:${crypto.randomUUID()}`, emailOtpLimiter)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(3)
  })
})
