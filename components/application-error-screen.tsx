'use client'

import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon, Home01Icon, RefreshIcon } from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'

interface ApplicationErrorScreenProps {
  reference?: string | null
  onRetry: () => void
  details?: string
}

export function ApplicationErrorScreen({
  reference,
  onRetry,
  details,
}: ApplicationErrorScreenProps) {
  return (
    <main
      id="main-content"
      role="alert"
      aria-live="assertive"
      className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <HugeiconsIcon icon={AlertCircleIcon} aria-hidden="true" className="mx-auto size-12 text-destructive" strokeWidth={1.5} color="currentColor" />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground">
            The error was recorded. Try again, or return home if it continues.
          </p>
        </div>
        {reference ? (
          <p className="font-mono text-xs text-muted-foreground">
            Reference: {reference}
          </p>
        ) : null}
        {process.env.NODE_ENV === 'development' && details ? (
          <pre className="max-h-32 overflow-auto text-left text-xs text-muted-foreground">
            {details}
          </pre>
        ) : null}
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={onRetry} className="gap-2">
            <HugeiconsIcon icon={RefreshIcon} aria-hidden="true" className="size-4" strokeWidth={1.5} color="currentColor" />
            Try again
          </Button>
          <Button asChild variant="secondary" className="gap-2">
            <Link href="/">
              <HugeiconsIcon icon={Home01Icon} aria-hidden="true" className="size-4" strokeWidth={1.5} color="currentColor" />
              Return home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
