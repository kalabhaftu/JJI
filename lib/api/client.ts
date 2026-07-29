import { reportError } from '@/lib/observability/report-error'

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
  readonly requestId?: string
  readonly details?: unknown

  constructor(input: {
    message: string
    status: number
    code?: string
    requestId?: string
    details?: unknown
  }) {
    super(input.message)
    this.name = 'ApiClientError'
    this.status = input.status
    this.code = input.code ?? 'REQUEST_FAILED'
    this.requestId = input.requestId
    this.details = input.details
  }
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
    reportError(error, {
      surface: 'client',
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
      reportError(error, {
        surface: 'client',
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
    throw new ApiClientError({
      message: typeof errorBody === 'string'
        ? errorBody
        : errorBody?.message ?? `Request failed with status ${response.status}`,
      status: response.status,
      code: typeof errorBody === 'object' && errorBody?.code
        ? errorBody.code
        : 'REQUEST_FAILED',
      requestId: payload?.requestId ?? requestId,
      details: typeof errorBody === 'object' ? errorBody?.details : undefined,
    })
  }

  return {
    ...payload,
    requestId: payload.requestId ?? requestId,
  }
}
