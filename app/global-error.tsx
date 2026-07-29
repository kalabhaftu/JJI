'use client'

import React from 'react'

import { ApplicationErrorScreen } from '@/components/application-error-screen'
import { reportError } from '@/lib/observability/report-error'

interface GlobalErrorProps {
    error: Error & { digest?: string }
    reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
    const [reference, setReference] = React.useState<string | null>(error.digest ?? null)

    React.useEffect(() => {
        const eventId = reportError(error, {
            surface: 'client',
            operation: 'global-render',
            route: window.location.pathname,
            level: 'fatal',
        })
        setReference(error.digest ?? eventId)
    }, [error])

    return (
        <html>
            <body>
                <ApplicationErrorScreen
                    reference={reference}
                    onRetry={reset}
                    details={error.message}
                />
            </body>
        </html>
    )
}
