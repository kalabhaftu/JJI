'use client'

import React, { Component, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, RefreshCcw, ArrowLeft } from "lucide-react"
import { reportError } from '@/lib/observability/report-error'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class PropFirmErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError(error, {
      surface: 'client',
      operation: 'render-prop-firm-account',
      extra: { componentStack: errorInfo.componentStack },
    })
  }

  handleReset = () => {
    this.setState({ hasError: false } as unknown as ErrorBoundaryState)
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  An unexpected error occurred while loading the account data.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={this.handleReset} className="flex-1">
                <RefreshCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export function AccountNotFoundError({
  accountId,
  onRetry,
  onGoBack
}: {
  accountId: string
  onRetry?: () => void
  onGoBack?: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Account Not Found
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Account {accountId} could not be found. It may have been deleted or you may not have permission to view it.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            {onRetry && (
              <Button onClick={onRetry} variant="outline" className="flex-1">
                <RefreshCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
            <Button
              onClick={onGoBack || (() => window.history.back())}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Accounts
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ConnectionError({
  error,
  onRetry
}: {
  error: string
  onRetry?: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Connection Error: {error}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
