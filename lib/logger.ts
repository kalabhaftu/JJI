import pino from 'pino'
import * as Sentry from '@sentry/nextjs'
import { scrubSentryContext } from '@/lib/observability/sentry-scrub'

const pinoLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
})

// Known benign error patterns that can safely be dropped
const IGNORE_PATTERNS = [
  'ResizeObserver loop',
  'The play() request was interrupted',
  'AbortError',
  'ResizeObserver loop completed with undelivered notifications',
]

export function shouldIgnoreError(message?: string, metadata?: unknown): boolean {
  if (!message) return false
  return IGNORE_PATTERNS.some((p) => message.includes(p))
}

const originalError = pinoLogger.error.bind(pinoLogger) as (...args: any[]) => void

pinoLogger.error = (...args: any[]) => {
  originalError(...args)

    try {
      let messageStr = ''
      let errorObj: Error | null = null
      let extraContext: Record<string, any> = {}

      for (const arg of args) {
        if (arg instanceof Error) {
          errorObj = arg
          messageStr += (messageStr ? ' ' : '') + arg.message
        } else if (typeof arg === 'string') {
          messageStr += (messageStr ? ' ' : '') + arg
        } else if (typeof arg === 'object' && arg !== null) {
          if (arg.err instanceof Error) {
            errorObj = arg.err
          } else if (arg.error instanceof Error) {
            errorObj = arg.error
          } else if (arg.message && typeof arg.message === 'string') {
            messageStr += (messageStr ? ' ' : '') + arg.message
          }
          extraContext = scrubSentryContext({ ...extraContext, ...arg })
        }
      }

      if (shouldIgnoreError(messageStr, extraContext)) return

      if (errorObj) {
        Sentry.captureException(errorObj, {
          extra: extraContext,
        })
      } else if (messageStr) {
        Sentry.captureMessage(messageStr, {
          level: 'error',
          extra: extraContext,
        })
      } else {
        Sentry.captureMessage('Unknown error logged', {
          level: 'error',
          extra: { args },
        })
      }
    } catch (e) {
      originalError({ err: e }, 'Failed to send error to Sentry')
    }
  }

const logger = pinoLogger as pino.Logger

export { logger }
export default logger
