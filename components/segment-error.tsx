'use client'

import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, RefreshIcon } from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/observability/report-error'

export function SegmentError({
  error,
  reset,
  surface,
}: {
  error: Error & { digest?: string }
  reset: () => void
  surface: string
}) {
  const [reference, setReference] = useState<string | null>(error.digest ?? null)

  useEffect(() => {
    const eventId = reportError(error, {
      surface: 'client',
      operation: 'segment-render',
      route: window.location.pathname,
      tags: { segment: surface },
    })
    setReference(error.digest ?? eventId)
  }, [error, surface])

  return (
    <section
      role="alert"
      aria-live="assertive"
      className="mx-auto my-12 flex max-w-lg flex-col items-center gap-4 p-6 text-center"
    >
      <HugeiconsIcon icon={Alert02Icon} aria-hidden="true" className="size-9 text-destructive" strokeWidth={1.5} color="currentColor" />
      <div>
        <h1 className="text-xl font-semibold">This section could not load</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The error was recorded. Retry to continue.
        </p>
      </div>
      {reference ? (
        <p className="font-mono text-xs text-muted-foreground">
          Reference: {reference}
        </p>
      ) : null}
      {process.env.NODE_ENV === 'development' ? (
        <pre className="max-h-32 max-w-full overflow-auto text-left text-xs">
          {error.message}
        </pre>
      ) : null}
      <Button onClick={reset} variant="secondary" className="gap-2">
        <HugeiconsIcon icon={RefreshIcon} aria-hidden="true" className="size-4" strokeWidth={1.5} color="currentColor" />
        Try again
      </Button>
    </section>
  )
}
