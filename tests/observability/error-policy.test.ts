import { describe, expect, it } from 'vitest'
import { ApiClientError } from '@/lib/api/errors'
import { isExpectedError, shouldIgnoreError } from '@/lib/observability/error-policy'

describe('Observability Error Policy', () => {
  it('identifies ignored client-side transient errors', () => {
    expect(shouldIgnoreError('ResizeObserver loop completed with undelivered notifications')).toBe(true)
    expect(shouldIgnoreError('The play() request was interrupted by a call to pause()')).toBe(true)
    expect(shouldIgnoreError('AbortError: The user aborted a request.')).toBe(true)
    expect(shouldIgnoreError('Unhandled Database Connection Exception')).toBe(false)
  })

  it('marks explicit expected context and 4xx status as expected', () => {
    expect(isExpectedError(new Error('Invalid form input'), { expected: true })).toBe(true)
    expect(isExpectedError(new Error('Bad Request'), { status: 400 })).toBe(true)
    expect(isExpectedError(new Error('Not Found'), { status: 404 })).toBe(true)
    expect(isExpectedError(new Error('Internal Server Error'), { status: 500 })).toBe(false)
  })

  it('marks ApiClientError cancellations as expected without error report noise', () => {
    const cancelledError = new ApiClientError({
      message: 'Request cancelled',
      status: 0,
      kind: 'cancelled',
      isCancellation: true,
    })
    expect(isExpectedError(cancelledError)).toBe(true)

    const networkFailure = new ApiClientError({
      message: 'Network request failed',
      status: 500,
      kind: 'server_error',
    })
    expect(isExpectedError(networkFailure)).toBe(false)
  })

  it('marks DOM AbortError and CanceledError as expected', () => {
    const abortErr = new Error('The operation was aborted')
    abortErr.name = 'AbortError'
    expect(isExpectedError(abortErr)).toBe(true)

    const canceledErr = new Error('Request canceled by user')
    canceledErr.name = 'CanceledError'
    expect(isExpectedError(canceledErr)).toBe(true)
  })

  it('marks ApiClientError offline kind as expected', () => {
    const offlineErr = new ApiClientError({
      message: 'Network offline',
      status: 0,
      kind: 'offline',
    })
    expect(isExpectedError(offlineErr)).toBe(true)
  })
})
