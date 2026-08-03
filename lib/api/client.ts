import { reportClientError } from '@/lib/observability/report-error'
import { composeAbortSignals } from '@/lib/api/signals'

export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'rate_limited' | 'timeout' | 'cancelled' | 'offline' | 'server' | 'invalid_response' | 'unknown'
export interface ApiRequestOptions extends RequestInit { timeoutMs?: number; retry?: { maxAttempts?: number; mode?: 'never' | 'safe' }; operation?: string }
export function isRetryAllowed(method: string | undefined, mode: 'never' | 'safe' = 'never') {
  return mode === 'safe' && ['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase())
}

interface ApiErrorEnvelope {
  success: false
  error: string | {
    code?: string
    message?: string
    details?: unknown
  }
  requestId?: string
}

interface ApiSuccessEnvelope<T> {
  success: true
  data: T | null
  requestId?: string
  message?: string
}

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | undefined
  readonly details?: unknown
  readonly retryAfterSeconds: number | undefined
  readonly kind: ApiErrorKind
  readonly isCancellation: boolean
  readonly isTimeout: boolean

  constructor(input: {
    message: string
    status: number
    code?: string
    requestId?: string
    details?: unknown
    retryAfterSeconds?: number
    kind?: ApiErrorKind
    isCancellation?: boolean
    isTimeout?: boolean
  }) {
    super(input.message)
    this.name = 'ApiClientError'
    this.status = input.status
    this.code = input.code ?? 'REQUEST_FAILED'
    this.requestId = input.requestId
    this.details = input.details
    this.retryAfterSeconds = input.retryAfterSeconds ?? (typeof input.details === 'object'
      && input.details !== null
      && 'retryAfterSeconds' in input.details
      && typeof (input.details as { retryAfterSeconds?: unknown }).retryAfterSeconds === 'number'
      ? (input.details as { retryAfterSeconds: number }).retryAfterSeconds
      : undefined)
    this.kind = input.kind ?? 'unknown'
    this.isCancellation = input.isCancellation ?? false
    this.isTimeout = input.isTimeout ?? false
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return undefined
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1_000))
}

export async function apiRequest<T>(
  input: string,
  init?: ApiRequestOptions,
): Promise<ApiSuccessEnvelope<T>> {
  const { timeoutMs = 30_000, retry, ...requestInit } = init ?? {}
  const composed = composeAbortSignals(requestInit.signal, timeoutMs)
  let response: Response
  try {
    response = await fetch(input, {
      ...requestInit,
      signal: composed.signal,
      headers: {
        ...(typeof init?.body === 'string'
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...init?.headers,
      },
    })
  } catch (error) {
    composed.cleanup()
    if (error instanceof Error && error.name === 'AbortError') {
      const timedOut = composed.didTimeout()
      throw new ApiClientError({ message: timedOut ? 'Request timed out' : 'Request cancelled', status: 0, kind: timedOut ? 'timeout' : 'cancelled', isCancellation: !timedOut, isTimeout: timedOut })
    }
    reportClientError(error, {
      operation: 'api-network-request',
      route: input,
    })
    throw new ApiClientError({
      message: error instanceof Error ? error.message : 'Network request failed',
      status: 0,
      kind: 'offline',
    })
  }
  composed.cleanup()

  const requestId = response.headers.get('x-request-id') ?? undefined
  let payload: ApiSuccessEnvelope<T> | ApiErrorEnvelope | null = null
  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      payload = await response.json()
    } catch (error) {
      reportClientError(error, {
        operation: 'parse-api-response',
        route: input,
        ...(requestId ? { requestId } : {}),
      })
    }
  }

  if (!response.ok || !payload || payload.success === false) {
    const errorBody = payload && payload.success === false
      ? payload.error
      : null
    const responseRequestId = payload?.requestId ?? requestId
    const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'))
    const apiError = new ApiClientError({
      message: typeof errorBody === 'string'
        ? errorBody
        : errorBody?.message ?? `Request failed with status ${response.status}`,
      status: response.status,
      code: typeof errorBody === 'object' && errorBody?.code
        ? errorBody.code
        : 'REQUEST_FAILED',
      ...(responseRequestId ? { requestId: responseRequestId } : {}),
      details: typeof errorBody === 'object' ? errorBody?.details : undefined,
      kind: response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : response.status === 404 ? 'not_found' : response.status === 409 ? 'conflict' : response.status === 422 ? 'validation' : response.status === 429 ? 'rate_limited' : response.status >= 500 ? 'server' : 'unknown',
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    })
    if (response.status === 429 || response.status >= 500) {
      reportClientError(apiError, {
        operation: 'api-response-failure',
        route: input,
        ...(apiError.requestId ? { requestId: apiError.requestId } : {}),
        extra: {
          code: apiError.code,
          ...(apiError.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: apiError.retryAfterSeconds }
            : {}),
        },
        level: response.status === 429 ? 'warning' : 'error',
      })
    }
    throw apiError
  }

  return {
    ...payload,
    ...((payload.requestId ?? requestId)
      ? { requestId: (payload.requestId ?? requestId)! }
      : {}),
  }
}

export async function apiRequestData<T>(input: string, init?: ApiRequestOptions): Promise<T> {
  const response = await apiRequest<T>(input, init)
  return response.data as T
}
