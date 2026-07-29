import { reportError } from '@/lib/observability/report-error'

type ErrorSource = 'CLIENT' | 'SERVER' | 'API'
type ErrorLevel = 'WARNING' | 'ERROR' | 'CRITICAL'

interface SentryErrorInput {
  source: ErrorSource
  level?: ErrorLevel | undefined
  message: string
  stack?: string | undefined
  url?: string | undefined
  userId?: string | undefined
  metadata?: Record<string, unknown> | undefined
  ipAddress?: string | undefined
}

export async function logError(input: SentryErrorInput): Promise<void> {
  const error = new Error(String(input.message || 'Unexpected application error'))
  if (input.stack) error.stack = input.stack

  const reportContext = {
    surface: input.source === 'CLIENT'
      ? 'client'
      : input.source === 'API'
        ? 'api'
        : 'server',
    operation: 'legacy-error-report',
    level: input.level === 'WARNING'
      ? 'warning'
      : input.level === 'CRITICAL'
        ? 'fatal'
        : 'error',
    extra: {
      ipAddress: input.ipAddress,
      metadata: input.metadata,
    },
    ...(input.url ? { route: input.url } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
  } as const

  reportError(error, reportContext)
}

/**
 * Log a server/API error with request context.
 */
export async function logServerError(
  error: unknown,
  context: {
    url?: string
    userId?: string
    ipAddress?: string
    source?: ErrorSource
    metadata?: Record<string, unknown>
  } = {}
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error))

  await logError({
    source: context.source ?? 'SERVER',
    level: 'ERROR',
    message: err.message,
    stack: err.stack,
    url: context.url,
    userId: context.userId,
    ipAddress: context.ipAddress,
    metadata: context.metadata,
  })
}
