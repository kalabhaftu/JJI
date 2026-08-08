import { composeAbortSignals } from '@/lib/api/signals'
import { ApiClientError, classifyApiStatus } from '@/lib/api/errors'
import { reportClientError } from '@/lib/observability/report-error'

export interface ApiStreamRequestOptions extends RequestInit {
  timeoutMs?: number
  operation?: string
}

interface ApiStreamErrorEnvelope {
  success: false
  error?: string | { code?: string; message?: string; details?: unknown }
  requestId?: string
}

export async function apiStreamRequest(
  input: string,
  init?: ApiStreamRequestOptions,
): Promise<Response> {
  const { timeoutMs = 60_000, operation, ...requestInit } = init ?? {}
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
      throw new ApiClientError({ message: 'Network offline', status: 0, kind: 'offline' })
    }
    reportClientError(error, { operation: operation ?? 'api-network-request', route: input })
    throw new ApiClientError({
      message: error instanceof Error ? error.message : 'Network request failed',
      status: 0,
      kind: 'offline',
    })
  }
  composed.cleanup()

  if (!response.ok) {
    const requestId = response.headers.get('x-request-id') ?? undefined
    let payload: ApiStreamErrorEnvelope | null = null
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        payload = await response.json()
      } catch {
        payload = null
      }
    }
    const errorBody = payload?.success === false ? payload.error : null
    const responseRequestId = payload?.requestId ?? requestId
    const apiError = new ApiClientError({
      message:
        typeof errorBody === 'string'
          ? errorBody
          : errorBody?.message ?? `Request failed with status ${response.status}`,
      status: response.status,
      code: typeof errorBody === 'object' && errorBody?.code ? errorBody.code : 'REQUEST_FAILED',
      ...(responseRequestId ? { requestId: responseRequestId } : {}),
      details: typeof errorBody === 'object' ? errorBody?.details : undefined,
      kind: classifyApiStatus(response.status),
    })
    if (response.status === 429 || response.status >= 500) {
      reportClientError(apiError, {
        operation: operation ?? 'api-response-failure',
        route: input,
        ...(apiError.requestId ? { requestId: apiError.requestId } : {}),
      })
    }
    throw apiError
  }

  return response
}
