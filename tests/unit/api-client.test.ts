import { afterEach, describe, expect, it, vi } from 'vitest'

const { reportClientError } = vi.hoisted(() => ({
  reportClientError: vi.fn(() => 'event-id'),
}))

vi.mock('@/lib/observability/report-error', () => ({
  reportClientError,
}))

import { ApiClientError, apiRequest } from '@/lib/api/client'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  reportClientError.mockClear()
})

describe('apiRequest observability contract', () => {
  it('preserves rate-limit metadata and reports 429 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        details: { retryAfterSeconds: 300 },
      },
      requestId: 'request-1234',
    }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'x-request-id': 'request-1234' },
    })))

    await expect(apiRequest('/api/v1/user/delete', { method: 'DELETE' })).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      requestId: 'request-1234',
      retryAfterSeconds: 300,
    })
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ApiClientError', status: 429 }),
      expect.objectContaining({
        operation: 'api-response-failure',
        route: '/api/v1/user/delete',
        requestId: 'request-1234',
      }),
    )
  })

  it('reports 5xx responses and does not report ordinary 4xx responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' },
        requestId: 'request-500',
      }), { status: 500, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: 'request-401',
      }), { status: 401, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/api/v1/failing')).rejects.toBeInstanceOf(ApiClientError)
    await expect(apiRequest('/api/v1/unauthorized')).rejects.toMatchObject({ status: 401 })
    expect(reportClientError).toHaveBeenCalledTimes(1)
  })

  it('preserves Retry-After headers when the error body omits retry timing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
    }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '45' },
    })))

    await expect(apiRequest('/api/v1/user/delete', { method: 'DELETE' })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: 45,
    })
  })
})
