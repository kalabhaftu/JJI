'use client'

import { Spinner } from '@/components/ui/spinner'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

interface LoadingOverlayProps {
  text?: string
  position?: 'fixed' | 'absolute'
  className?: string
}

interface LoadingSkeletonProps {
  variant?: 'card' | 'table' | 'chart' | 'list'
  rows?: number
  className?: string
}

function LoadingSpinner({ size = 'md', text, className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Spinner className={cn('text-primary', sizeClasses[size])} />
      {text && (
        <span className={cn('text-muted-foreground', textSizeClasses[size])}>
          {text}
        </span>
      )}
    </div>
  )
}

export function LoadingOverlay({ text = 'Loading...', position = 'absolute', className }: LoadingOverlayProps) {
  const positionClasses = {
    fixed: 'fixed inset-0',
    absolute: 'absolute inset-0'
  }

  return (
    <div className={cn(
      'z-50 flex items-center justify-center bg-background/95',
      positionClasses[position],
      className
    )}>
      <div className="flex flex-col items-center gap-3 rounded-lg bg-background p-6 shadow-lg border">
        <Spinner className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

export function LoadingToast({ text = 'Loading...', className }: { text?: string; className?: string }) {
  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md bg-background px-3 py-2 shadow-lg border',
      className
    )}>
      <Spinner className="h-4 w-4 text-primary" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function LoadingSkeleton({ variant = 'card', rows = 3, className }: LoadingSkeletonProps) {
  switch (variant) {
    case 'card':
      return (
        <Card className={className}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full" />
              <div className="flex space-x-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      )

    case 'table':
      return (
        <Card className={className}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <div className="space-y-2">
                <div className="flex space-x-4 border-b pb-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                {Array.from({ length: rows }).map((_, i) => (
                  <div key={i} className="flex space-x-4 py-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )

    case 'chart':
      return (
        <Card className={className}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-48 w-full rounded-lg" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </CardContent>
        </Card>
      )

    case 'list':
      return (
        <div className={cn('space-y-3', className)}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-3 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      )

    default:
      return (
        <div className={cn('flex items-center justify-center p-8', className)}>
          <LoadingSpinner text="Loading..." />
        </div>
      )
  }
}

function LoadingButton({
  children,
  loading = false,
  loadingText = 'Loading...',
  className,
  ...props
}: {
  children: React.ReactNode
  loading?: boolean
  loadingText?: string
  className?: string
  [key: string]: any
}) {
  return (
    <button
      className={cn('flex items-center gap-2', className)}
      disabled={loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {loading ? loadingText : children}
    </button>
  )
}

function PageLoading({ text = 'Loading page...', className }: { text?: string; className?: string }) {
  return (
    <div className={cn('flex min-h-screen items-center justify-center', className)}>
      <div className="flex flex-col items-center gap-4">
        <Spinner className="h-12 w-12 text-primary" />
        <p className="text-lg text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}
