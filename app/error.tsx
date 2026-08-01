'use client'

import { useEffect, useState } from 'react'

import { ApplicationErrorScreen } from '@/components/application-error-screen'
import { reportError } from '@/lib/observability/report-error'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [reference, setReference] = useState<string | null>(error.digest ?? null)

  useEffect(() => {
    const eventId = reportError(error, {
      surface: 'client',
      operation: 'app-route-render',
      route: window.location.pathname,
    })
    setReference(error.digest ?? eventId)
  }, [error])

  return (
    <div role="alert" aria-live="assertive">
      <ApplicationErrorScreen
        reference={reference}
        onRetry={reset}
        details={error.message}
      />
    </div>
  )
}
