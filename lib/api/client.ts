import { composeAbortSignals } from '@/lib/api/signals'
import { ApiClientError, classifyApiStatus, isSafeRetryMethod } from '@/lib/api/errors'
export { ApiClientError, type ApiErrorKind } from '@/lib/api/errors'
import { reportClientError } from '@/lib/observability/report-error'

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number
  retry?: { maxAttempts?: number; mode?: 'never' | 'safe' }
  operation?: string
}

export function isRetryAllowed(method: string | undefined, mode: 'never' | 'safe' = 'never') {
  return mode === 'safe' && isSafeRetryMethod(method)
}

interface ApiErrorEnvelope {
  success: false
  error: string | { code?: string; message?: string; details?: unknown }
  requestId?: string
}

interface ApiSuccessEnvelope<T> {
  success: true
  data: T | null
  requestId?: string
  message?: string
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? Math.max(0, Math.ceil((timestamp - Date.now()) / 1_000)) : undefined
}

function isSuccessEnvelope<T>(payload: unknown): payload is ApiSuccessEnvelope<T> {
  return typeof payload === 'object' && payload !== null && (payload as { success?: unknown }).success === true && 'data' in payload
}

export async function apiRequest<T>(input: string, init?: ApiRequestOptions): Promise<ApiSuccessEnvelope<T>> {
  const { timeoutMs = 30_000, retry = { mode: 'safe', maxAttempts: 1 }, ...requestInit } = init ?? {}
  const maxAttempts = isRetryAllowed(requestInit.method, retry.mode) ? Math.max(1, retry.maxAttempts ?? 2) : 1

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const composed = composeAbortSignals(requestInit.signal, timeoutMs)
    let response: Response
    try {
      response = await fetch(input, {
        ...requestInit,
        signal: composed.signal,
        headers: {
          ...(typeof requestInit.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
          ...requestInit.headers,
        },
      })
    } catch (error) {
      const timedOut = composed.didTimeout()
      composed.cleanup()
      const isCancellation = Boolean(
        (requestInit.signal?.aborted && !timedOut)
        || (!timedOut && error instanceof Error && (
          error.name === 'AbortError'
          || error.name === 'CanceledError'
          || error.message.includes('aborted')
          || error.message.includes('AbortError')
          || error.message.includes('signal is aborted')
        ))
      )
      if (isCancellation || timedOut) {
        throw new ApiClientError({
          message: timedOut ? 'Request timed out' : 'Request cancelled',
          status: 0,
          kind: timedOut ? 'timeout' : 'cancelled',
          isCancellation,
          isTimeout: timedOut,
        })
      }
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false
      if (isOffline) {
        if (attempt < maxAttempts) continue
        throw new ApiClientError({ message: 'Network offline', status: 0, kind: 'offline' })
      }
      reportClientError(error, { operation: 'api-network-request', route: input })
      if (attempt < maxAttempts) continue
      throw new ApiClientError({ message: error instanceof Error ? error.message : 'Network request failed', status: 0, kind: 'offline' })
    }
    composed.cleanup()

    const requestId = response.headers.get('x-request-id') ?? undefined
    let payload: ApiSuccessEnvelope<T> | ApiErrorEnvelope | null = null
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        payload = await response.json()
      } catch (error) {
        reportClientError(error, { operation: 'parse-api-response', route: input, ...(requestId ? { requestId } : {}) })
      }
    }

    if (!response.ok) {
      const errorBody = payload && payload.success === false ? payload.error : null
      const responseRequestId = payload?.requestId ?? requestId
      const apiError = new ApiClientError({
        message: typeof errorBody === 'string' ? errorBody : errorBody?.message ?? `Request failed with status ${response.status}`,
        status: response.status,
        code: typeof errorBody === 'object' && errorBody?.code ? errorBody.code : 'REQUEST_FAILED',
        ...(responseRequestId ? { requestId: responseRequestId } : {}),
        details: typeof errorBody === 'object' ? errorBody?.details : undefined,
        kind: classifyApiStatus(response.status),
        ...(parseRetryAfter(response.headers.get('retry-after')) !== undefined ? { retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after'))! } : {}),
      })
      if (response.status === 429 || response.status >= 500) {
        reportClientError(apiError, { operation: 'api-response-failure', route: input, ...(apiError.requestId ? { requestId: apiError.requestId } : {}) })
      }
      if (attempt < maxAttempts && (response.status === 408 || response.status === 429 || response.status >= 500)) continue
      throw apiError
    }

    if (!isSuccessEnvelope<T>(payload)) {
      throw new ApiClientError({ message: 'Invalid API response', status: response.status, ...(requestId ? { requestId } : {}), kind: 'invalid_response' })
    }

    const responseRequestId = payload.requestId ?? requestId
    return { ...payload, ...(responseRequestId ? { requestId: responseRequestId } : {}) }
  }

  throw new ApiClientError({ message: 'Request failed after retries', status: 0, kind: 'unknown' })
}

export async function apiRequestData<T>(input: string, init?: ApiRequestOptions): Promise<T> {
  const response = await apiRequest<T>(input, init)
  return response.data as T
}
