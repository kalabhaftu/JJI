import { reportClientError } from '@/lib/observability/report-error'

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

  constructor(input: {
    message: string
    status: number
    code?: string
    requestId?: string
    details?: unknown
    retryAfterSeconds?: number
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
  init?: RequestInit,
): Promise<ApiSuccessEnvelope<T>> {
  let response: Response
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        ...(typeof init?.body === 'string'
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...init?.headers,
      },
    })
  } catch (error) {
    reportClientError(error, {
      operation: 'api-network-request',
      route: input,
    })
    throw error
  }

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
