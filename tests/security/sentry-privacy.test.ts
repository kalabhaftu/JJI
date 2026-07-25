import { describe, expect, it } from 'vitest'
import { scrubSentryEvent } from '@/lib/observability/sentry-scrub'

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
})
