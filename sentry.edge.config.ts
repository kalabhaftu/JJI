import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent, shouldDropSentryEvent } from '@/lib/observability/sentry-scrub'

// Only initialize Sentry if DSN is provided (optional for personal use)
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Performance monitoring
    tracesSampleRate: 0.1,
    
    // Environment
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    
    // Don't report in development
    enabled: process.env.NODE_ENV === 'production',
    beforeSend(event, hint) {
      if (shouldDropSentryEvent(event, hint.originalException)) return null
      return scrubSentryEvent(event)
    },
  })
}
