import { ApiClientError } from '@/lib/api/errors'

const IGNORED_ERROR_PATTERNS = [
  'ResizeObserver loop',
  'The play() request was interrupted',
  'AbortError',
  'The user aborted a request',
  'signal is aborted without reason',
  'ResizeObserver loop completed with undelivered notifications',
  'NEXT_REDIRECT',
  'NEXT_HTTP_ERROR_FALLBACK;',
  'Invalid Refresh Token: Refresh Token Not Found',
  "Lock broken by another request with the 'steal' option.",
] as const

export interface ErrorPolicyContext {
  expected?: boolean
  status?: number
}

export function shouldIgnoreError(message?: string, _metadata?: unknown): boolean {
  if (!message) return false
  return IGNORED_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}

export function isExpectedError(
  error: unknown,
  context: ErrorPolicyContext = {},
): boolean {
  if (context.expected) return true
  if (
    context.status !== undefined
    && context.status >= 400
    && context.status < 500
  ) {
    return true
  }

  if (error instanceof ApiClientError) {
    if (error.isCancellation || error.kind === 'cancelled' || error.kind === 'offline') return true
  }

  const message = error instanceof Error ? error.message : String(error ?? '')
  const name = error instanceof Error ? error.name : ''
  if (name === 'AbortError' || name === 'CanceledError') return true
  if (typeof navigator !== 'undefined' && !navigator.onLine && (
    message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('Load failed')
  )) {
    return true
  }
  return shouldIgnoreError(message)
}
