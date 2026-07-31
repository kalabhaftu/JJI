import * as Sentry from '@sentry/nextjs'

import logger from '@/lib/logger';

type ErrorSource = 'CLIENT' | 'SERVER' | 'API'
type ErrorLevel = 'WARNING' | 'ERROR' | 'CRITICAL'

export function shouldIgnoreError(message: string, metadata?: Record<string, unknown>) {
  return false;
}

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
  try {
    const messageStr = String(input.message || '')
    if (shouldIgnoreError(messageStr, input.metadata)) {
      return
    }

    const error = new Error(messageStr)
    if (input.stack) error.stack = input.stack

    const context = {
      level: input.level === 'WARNING' ? 'warning' : 'error',
      tags: { source: input.source },
      extra: {
        url: input.url,
        ipAddress: input.ipAddress,
        metadata: input.metadata,
      },
      ...(input.userId ? { user: { id: input.userId } } : {}),
    } satisfies NonNullable<Parameters<typeof Sentry.captureException>[1]>

    Sentry.captureException(error, context)
  } catch (err) {
    logger.error({ err }, '[SentryCapture] Failed to capture error:')
  }
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
