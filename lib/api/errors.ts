export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'rate_limited' | 'timeout' | 'cancelled' | 'offline' | 'server' | 'invalid_response' | 'unknown'

export function isSafeRetryMethod(method: string | undefined): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase())
}

export function classifyApiStatus(status: number, validEnvelope = true): ApiErrorKind {
  if (!validEnvelope) return 'invalid_response'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 422) return 'validation'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'server'
  return 'unknown'
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

  constructor(input: { message: string; status: number; code?: string; requestId?: string; details?: unknown; retryAfterSeconds?: number; kind?: ApiErrorKind; isCancellation?: boolean; isTimeout?: boolean }) {
    super(input.message)
    this.name = 'ApiClientError'
    this.status = input.status
    this.code = input.code ?? 'REQUEST_FAILED'
    this.requestId = input.requestId
    this.details = input.details
    this.retryAfterSeconds = input.retryAfterSeconds ?? (typeof input.details === 'object' && input.details !== null && 'retryAfterSeconds' in input.details && typeof (input.details as { retryAfterSeconds?: unknown }).retryAfterSeconds === 'number' ? (input.details as { retryAfterSeconds: number }).retryAfterSeconds : undefined)
    this.kind = input.kind ?? 'unknown'
    this.isCancellation = input.isCancellation ?? false
    this.isTimeout = input.isTimeout ?? false
  }
}
