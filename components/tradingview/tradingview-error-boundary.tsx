'use client'

import React from 'react'
import * as Sentry from '@sentry/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface TradingViewErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class TradingViewErrorBoundary extends React.Component<
  TradingViewErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: TradingViewErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { errorInfo } })
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Chart Loading Error
            </CardTitle>
            <CardDescription>
              The TradingView chart failed to load. This might be due to network issues or widget configuration problems.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>Error: {this.state.error?.message || 'Unknown error occurred'}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={this.handleRetry} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}


