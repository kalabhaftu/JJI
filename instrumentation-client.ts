import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent } from '@/lib/observability/sentry-scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) && process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.2,
  enableLogs: true,
  sendDefaultPii: false,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  beforeSend(event, hint) {
    const error = hint.originalException
    if (error instanceof Error && error.message?.includes('blocked by client')) return null
    return scrubSentryEvent(event)
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
