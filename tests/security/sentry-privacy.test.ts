import { describe, expect, it } from 'vitest'
import { scrubSentryEvent, shouldDropSentryEvent } from '@/lib/observability/sentry-scrub'

describe('Sentry privacy scrubber', () => {
  it('removes request bodies, credentials, journal content, and direct identifiers', () => {
    const event = scrubSentryEvent({
      request: {
        headers: { authorization: 'Bearer secret', cookie: 'session=secret' },
        data: { prompt: 'private journal' },
        query_string: 'token=secret',
      },
      user: { id: 'user-1', email: 'person@example.com', ip_address: '127.0.0.1' },
      extra: {
        route: '/api/v1/ai',
        prompt: 'private journal text',
        nested: { csv: 'raw import', operation: 'generate' },
      },
    })

    expect(event.request).toEqual({ headers: {} })
    expect(event.user).toEqual({ id: 'user-1' })
    expect(event.extra).toEqual({
      route: '/api/v1/ai',
      nested: { operation: 'generate' },
    })
  })

  it('drops expected framework and recoverable auth control flow', () => {
    expect(shouldDropSentryEvent({
      exception: { values: [{ value: 'NEXT_HTTP_ERROR_FALLBACK;404' }] },
    })).toBe(true)
    expect(shouldDropSentryEvent({}, new Error('NEXT_REDIRECT'))).toBe(true)
    expect(shouldDropSentryEvent({
      exception: { values: [{ value: 'Invalid Refresh Token: Refresh Token Not Found' }] },
    })).toBe(true)
    expect(shouldDropSentryEvent({
      exception: { values: [{ value: 'Database connection failed' }] },
    })).toBe(false)
  })
})
