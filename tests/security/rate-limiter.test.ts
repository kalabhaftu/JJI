import { afterEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
  vi.resetModules()
})

describe('rate limiter production posture', () => {
  it('classifies account deletion separately from shared auth traffic', async () => {
    const { classifyApiRoute } = await import('@/lib/api/route-policy')
    expect(classifyApiRoute('/api/v1/user/delete', 'DELETE')).toBe('account-delete')
  })

  it('uses three attempts per five minutes for account deletion', async () => {
    const { accountDeletionLimiter } = await import('@/lib/rate-limiter')
    expect(accountDeletionLimiter).toEqual({ points: 3, duration: 300, failClosed: true })
  })

  it('fails closed for sensitive limiters in production without KV', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    const { consumeRateLimitKey, emailOtpLimiter } = await import('@/lib/rate-limiter')
    const result = await consumeRateLimitKey('rate-limit:email-otp:test', emailOtpLimiter)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('permits a development request when distributed enforcement is unavailable', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN

    const { consumeRateLimitKey, emailOtpLimiter } = await import('@/lib/rate-limiter')
    const result = await consumeRateLimitKey(`rate-limit:email-otp:${crypto.randomUUID()}`, emailOtpLimiter)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(3)
  })

  it('fails open only for the reviewed authenticated-read policy in production', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const {
      authenticatedReadLimiter,
      consumeRateLimitKey,
      sensitiveMutationLimiter,
    } = await import('@/lib/rate-limiter')
    const read = await consumeRateLimitKey(
      'rate-limit:read:test',
      authenticatedReadLimiter,
    )
    const mutation = await consumeRateLimitKey(
      'rate-limit:mutation:test',
      sensitiveMutationLimiter,
    )

    expect(read.allowed).toBe(true)
    expect(read.remaining).toBe(authenticatedReadLimiter.points)
    expect(mutation.allowed).toBe(false)
    expect(mutation.remaining).toBe(0)
  })
})
