'use client'

import * as Sentry from '@sentry/nextjs'
import logger from '@/lib/logger';

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Home } from "lucide-react"

interface GlobalErrorProps {
    error: Error & { digest?: string }
    reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
    React.useEffect(() => {
        Sentry.captureException(error)
        logger.error({ event: 'system_error', error: error }, 'Global Error Boundary caught:')
    }, [error])

    return (
        <html>
            <body className="antialiased min-h-screen bg-background text-foreground flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="p-4 rounded-full bg-destructive/10 text-destructive animate-pulse">
                            <AlertCircle className="h-12 w-12" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tighter">System Critical Error</h1>
                        <p className="text-muted-foreground">
                            A critical error occurred that prevented the application from rendering effectively.
                        </p>
                    </div>

                    {error.digest && (
                        <p className="rounded-xl bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button onClick={() => reset()} size="lg" className="w-full sm:w-auto gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Try Again
                        </Button>
                        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto gap-2"><Link href="/"><Home className="h-4 w-4" />Return Home</Link></Button>
                    </div>
                </div>
            </body>
        </html>
    )
}
