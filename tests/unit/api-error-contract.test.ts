import { describe, expect, it } from 'vitest'

import { ApiClientError, classifyApiStatus, isSafeRetryMethod } from '@/lib/api/errors'

describe('shared API error contract', () => {
  it('classifies HTTP statuses and malformed success responses', () => {
    expect(classifyApiStatus(401)).toBe('unauthorized')
    expect(classifyApiStatus(500)).toBe('server')
    expect(classifyApiStatus(200, false)).toBe('invalid_response')
    expect(new ApiClientError({ message: 'bad response', status: 200, kind: 'invalid_response' })).toMatchObject({
      kind: 'invalid_response',
      status: 200,
    })
  })

  it('only treats safe reads as retryable methods', () => {
    expect(isSafeRetryMethod('GET')).toBe(true)
    expect(isSafeRetryMethod('HEAD')).toBe(true)
    expect(isSafeRetryMethod('POST')).toBe(false)
    expect(isSafeRetryMethod('PATCH')).toBe(false)
  })
})
