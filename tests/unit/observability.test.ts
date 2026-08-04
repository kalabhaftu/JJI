import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  captureException,
  setTags,
  setExtras,
  setLevel,
  setUser,
  logError,
} = vi.hoisted(() => ({
  captureException: vi.fn(() => 'event-id'),
  setTags: vi.fn(),
  setExtras: vi.fn(),
  setLevel: vi.fn(),
  setUser: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException,
  withScope(callback: (scope: unknown) => unknown) {
    return callback({ setTags, setExtras, setLevel, setUser })
  },
}))

vi.mock('@/lib/logger', () => ({
  default: { error: logError },
}))

import { reportClientError, reportError } from '@/lib/observability/report-error'
import {
  createRequestId,
  normalizeRequestId,
  resolveRequestId,
} from '@/lib/observability/request-id'
import { scrubSentryEvent } from '@/lib/observability/sentry-scrub'
import { ApiClientError } from '@/lib/api/errors'

describe('request IDs', () => {
  it('accepts bounded safe IDs and rejects unsafe values', () => {
    expect(normalizeRequestId('request-1234')).toBe('request-1234')
    expect(normalizeRequestId('short')).toBeNull()
    expect(normalizeRequestId('bad request id')).toBeNull()
    expect(normalizeRequestId('a'.repeat(129))).toBeNull()
  })

  it('preserves a valid incoming ID and generates a UUID otherwise', () => {
    expect(resolveRequestId(new Headers({ 'x-request-id': 'request-1234' })))
      .toBe('request-1234')
    expect(resolveRequestId(new Headers())).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(createRequestId()).not.toBe(createRequestId())
  })
})

describe('reportError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('captures an unexpected Error once with structured context', () => {
    const error = new Error('boom')
    const context = {
      surface: 'api' as const,
      operation: 'save-trade',
      requestId: 'request-1234',
      userId: 'internal-user-id',
      extra: { authorization: 'secret', safeCount: 2 },
    }

    expect(reportError(error, context)).toBe('event-id')
    expect(reportError(error, context)).toBeNull()
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(logError).toHaveBeenCalledTimes(1)
    expect(setUser).toHaveBeenCalledWith({ id: 'internal-user-id' })
    expect(setExtras).toHaveBeenCalledWith({ safeCount: 2 })
  })

  it('does not report expected client errors', () => {
    expect(reportError(new Error('invalid input'), {
      surface: 'api',
      operation: 'validate',
      status: 400,
    })).toBeNull()
    expect(captureException).not.toHaveBeenCalled()
  })

  it('reports rate limits and server failures but suppresses ordinary 4xx responses', () => {
    const rateLimited = Object.assign(new Error('Too many requests'), { status: 429 })
    const serverFailure = Object.assign(new Error('Server failed'), { status: 500 })
    const unauthorized = Object.assign(new Error('Unauthorized'), { status: 401 })

    expect(reportClientError(rateLimited, {
      operation: 'api-response-failure',
      route: '/api/v1/user/delete',
    })).toBe('event-id')
    expect(reportClientError(serverFailure, {
      operation: 'api-response-failure',
      route: '/api/v1/user/delete',
    })).toBe('event-id')
    expect(reportClientError(unauthorized, {
      operation: 'api-response-failure',
      route: '/api/v1/user/delete',
    })).toBeNull()
    expect(reportClientError(Object.assign(new Error('Request aborted'), { name: 'AbortError' }), {
      operation: 'api-network-request',
      route: '/api/v1/user/delete',
    })).toBeNull()
    expect(captureException).toHaveBeenCalledTimes(2)
  })

  it('suppresses expected cancellations but still reports timeouts', () => {
    expect(reportClientError(new ApiClientError({
      message: 'Request cancelled',
      status: 0,
      isCancellation: true,
    }), {
      operation: 'load-notifications',
      route: '/api/v1/notifications',
    })).toBeNull()
    expect(captureException).not.toHaveBeenCalled()

    expect(reportClientError(new ApiClientError({
      message: 'Request timed out',
      status: 0,
      isTimeout: true,
    }), {
      operation: 'load-notifications',
      route: '/api/v1/notifications',
    })).toBe('event-id')
    expect(captureException).toHaveBeenCalledTimes(1)
  })
})

describe('Sentry privacy scrubber', () => {
  it('removes request bodies, credentials, PII, and private payload fields', () => {
    const event = scrubSentryEvent({
      message: 'Failure for trader@example.com',
      request: {
        headers: { authorization: 'Bearer private' },
        data: { trades: [{ pnl: 1 }] },
        cookies: { session: 'private' },
        query_string: 'token=private',
      },
      user: { id: 'internal-user', email: 'trader@example.com' },
      extra: {
        safeCount: 2,
        journalContent: 'private journal',
        uploadedImages: ['private image'],
        providerToken: 'private token',
      },
      contexts: {
        import: {
          jobId: 'job-1',
          csvPayload: 'private csv',
        },
      },
    })

    expect(event.message).not.toContain('trader@example.com')
    expect(event.request).toEqual({ headers: {} })
    expect(event.user).toEqual({ id: 'internal-user' })
    expect(event.extra).toEqual({ safeCount: 2 })
    expect(event.contexts).toEqual({ import: { jobId: 'job-1' } })
  })
})
