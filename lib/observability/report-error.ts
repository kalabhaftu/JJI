import * as Sentry from '@sentry/nextjs'

import logger from '@/lib/logger'
import { isExpectedError, type ErrorPolicyContext } from '@/lib/observability/error-policy'
import { scrubSentryContext } from '@/lib/observability/sentry-scrub'

export type ErrorSurface =
  | 'client'
  | 'server'
  | 'api'
  | 'background-job'
  | 'cron'
  | 'phase-evaluation'
  | 'import'

export interface ReportErrorContext extends ErrorPolicyContext {
  surface: ErrorSurface
  operation: string
  requestId?: string
  route?: string
  userId?: string
  entityId?: string
  jobId?: string
  level?: 'warning' | 'error' | 'fatal'
  tags?: Record<string, string | number | boolean | null | undefined>
  extra?: Record<string, unknown>
}

const reportedErrors = new WeakSet<Error>()
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const SECRET_VALUE = /\b(?:bearer\s+)?[A-Za-z0-9_-]{24,}\b/gi
const URL_QUERY = /([?&](?:token|key|secret|signature|code)=)[^&\s]+/gi

export function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === 'string') return new Error(error)

  return new Error('Unexpected application error', {
    cause: error,
  })
}

function safeErrorForReporting(error: Error): Error {
  const safeMessage = error.message
    .replace(EMAIL_VALUE, '[redacted-email]')
    .replace(URL_QUERY, '$1[redacted]')
    .replace(SECRET_VALUE, '[redacted-secret]')
    .slice(0, 1_000)
  if (safeMessage === error.message) return error

  const sanitized = new Error(safeMessage)
  sanitized.name = error.name
  return sanitized
}

export function getSafeErrorMessage(
  error: unknown,
  fallback = 'Unexpected application error',
): string {
  const normalized = normalizeError(error)
  const message = safeErrorForReporting(normalized).message.trim()
  return message || fallback
}

function compactTags(context: ReportErrorContext): Record<string, string> {
  const rawTags: Record<string, string | number | boolean | null | undefined> = {
    surface: context.surface,
    operation: context.operation,
    route: context.route,
    requestId: context.requestId,
    jobId: context.jobId,
    entityId: context.entityId,
    release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    ...context.tags,
  }

  return Object.fromEntries(
    Object.entries(rawTags)
      .filter((entry) => entry[1] !== null && entry[1] !== undefined)
      .map(([key, value]) => [
        key,
        String(value)
          .replace(EMAIL_VALUE, '[redacted-email]')
          .replace(URL_QUERY, '$1[redacted]')
          .replace(SECRET_VALUE, '[redacted-secret]')
          .slice(0, 200),
      ]),
  )
}

/**
 * Report an unexpected application failure exactly once.
 *
 * Logging and Sentry capture are deliberately explicit and separate from
 * `logger.error`, so ordinary operational logs cannot create duplicate issues.
 */
export function reportError(
  error: unknown,
  context: ReportErrorContext,
): string | null {
  const normalized = normalizeError(error)
  if (isExpectedError(normalized, context)) return null
  if (reportedErrors.has(normalized)) return null
  reportedErrors.add(normalized)
  const safeError = safeErrorForReporting(normalized)

  const tags = compactTags(context)
  const extra = scrubSentryContext(context.extra ?? {})

  logger.error(
    {
      err: safeError,
      event: 'unexpected_application_error',
      ...tags,
      extra,
    },
    `Unexpected error during ${context.operation}`,
  )

  return Sentry.withScope((scope) => {
    scope.setLevel(context.level ?? 'error')
    scope.setTags(tags)
    if (context.userId) scope.setUser({ id: context.userId })
    if (Object.keys(extra).length > 0) scope.setExtras(extra)
    return Sentry.captureException(safeError)
  })
}
