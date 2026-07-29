'use client'

import React, { Component, ErrorInfo, ReactNode, ReactElement } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { reportError } from '@/lib/observability/report-error'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onRetry?: () => void
  errorMessage?: string
  showRetry?: boolean
  className?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  isChunkError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const message = error?.message?.toLowerCase?.() || ''
    const isChunkError = message.includes('chunkloaderror') || message.includes('failed to load chunk')
    return { hasError: true, error, isChunkError }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    this.props.onError?.(error, errorInfo)

    reportError(error, {
      surface: 'client',
      operation: 'react-error-boundary',
      route: window.location.pathname,
      extra: { componentStack: errorInfo.componentStack },
    })
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, isChunkError: false })
    this.props.onRetry?.()
  }

  render(): ReactNode {
    const { hasError, error, isChunkError } = this.state
    const {
      children,
      fallback,
      errorMessage,
      showRetry = true,
      className = ''
    } = this.props

    if (hasError) {
      if (fallback) {
        return fallback
      }

      return (
        <Card role="alert" aria-live="assertive" className={`border-destructive/50 ${className}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {isChunkError
                ? 'A dashboard chunk failed to load. Retry first, or refresh the page if the widget bundle changed during navigation.'
                : errorMessage || 'An unexpected error occurred. Please try again.'}
            </p>
            {process.env.NODE_ENV === 'development' && error && (
              <pre className="mt-4 p-3 bg-muted rounded-md text-xs overflow-auto max-h-32">
                {error.message}
              </pre>
            )}
          </CardContent>
          {showRetry && (
            <CardFooter>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleRetry}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                {isChunkError && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh Page
                  </Button>
                )}
              </div>
            </CardFooter>
          )}
        </Card>
      )
    }

    return children
  }
}

interface ErrorBoundaryWrapperProps extends Omit<ErrorBoundaryProps, 'onRetry'> {
  resetKey?: string | number
  context?: string
  showDetails?: boolean
}

export function ErrorBoundaryWrapper({
  children,
  resetKey,
  context,
  showDetails,
  errorMessage,
  ...props
}: ErrorBoundaryWrapperProps): ReactElement {
  const [key, setKey] = React.useState(0)

  React.useEffect(() => {
    setKey(prev => prev + 1)
  }, [resetKey])

  const finalErrorMessage = errorMessage || (context ? `Error in ${context}` : undefined)

  return (
    <ErrorBoundary
      key={key}
      onRetry={() => setKey(prev => prev + 1)}
      {...(finalErrorMessage !== undefined && { errorMessage: finalErrorMessage })}
      {...props}
    >
      {children}
    </ErrorBoundary>
  )
}

interface DataErrorProps {
  error: string | null
  onRetry?: () => void
  className?: string
}

function DataError({ error, onRetry, className = '' }: DataErrorProps): ReactElement | null {
  if (!error) return null

  return (
    <div className={`flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg ${className}`}>
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      <p className="text-sm text-destructive flex-1">{error}</p>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="shrink-0"
          aria-label="Retry loading data"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

interface LoadingOrErrorProps {
  isLoading: boolean
  error: string | null
  onRetry?: () => void
  loadingComponent?: ReactNode
  children: ReactNode
}

function LoadingOrError({
  isLoading,
  error,
  onRetry,
  loadingComponent,
  children
}: LoadingOrErrorProps): ReactElement {
  if (isLoading) {
    return (
      <>
        {loadingComponent || (
          <div className="flex items-center justify-center p-8">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        )}
      </>
    )
  }

  if (error) {
    return <DataError error={error} {...(onRetry !== undefined && { onRetry })} />
  }

  return <>{children}</>
}

export function WidgetErrorBoundary({
  children,
  widgetId,
  widgetType
}: {
  children: ReactNode
  widgetId?: string
  widgetType?: string
}): ReactElement {
  return (
    <ErrorBoundaryWrapper
      errorMessage={`${widgetType || widgetId || 'Widget'} encountered an error`}
    >
      {children}
    </ErrorBoundaryWrapper>
  )
}

export function DashboardErrorBoundary({
  children,
  context,
  showDetails = false
}: {
  children: ReactNode
  context?: string
  showDetails?: boolean
}): ReactElement {
  return (
    <ErrorBoundaryWrapper
      errorMessage={context ? `Error in ${context}` : 'Dashboard error'}
    >
      {children}
    </ErrorBoundaryWrapper>
  )
}

