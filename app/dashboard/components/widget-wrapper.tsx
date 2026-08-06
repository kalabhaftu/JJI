'use client'

import React, { Component, type ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/observability/report-error'

interface WidgetErrorBoundaryProps {
  children: ReactNode
  widgetId?: string
  title?: string
}

interface WidgetErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError(error, {
      surface: 'client',
      operation: 'render-dashboard-widget',
      extra: {
        widgetId: this.props.widgetId,
        widgetTitle: this.props.title,
        componentStack: errorInfo.componentStack,
      },
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card role="alert" aria-live="assertive" className="h-full w-full border-destructive/20 bg-destructive/5">
          <CardContent className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="rounded-full bg-destructive/20 p-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-destructive">
                Failed to load widget
              </h3>
              <p className="max-w-[240px] text-sm text-destructive/80">
                An unexpected error occurred. Try again.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
