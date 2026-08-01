'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface LazyMobileWidgetProps {
  children: ReactNode
  minHeight?: number
  isEditMode: boolean
}

/** Defers off-screen mobile widgets without changing their layout footprint. */
export function LazyMobileWidget({ children, minHeight, isEditMode }: LazyMobileWidgetProps) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditMode) {
      setIsIntersecting(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsIntersecting(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )

    const element = ref.current
    if (element) observer.observe(element)

    return () => observer.disconnect()
  }, [isEditMode])

  return (
    <div
      ref={ref}
      style={{ minHeight }}
      className="flex min-h-0 w-full flex-col"
    >
      {isIntersecting ? (
        children
      ) : (
        <div
          aria-hidden="true"
          className="flex w-full flex-1 animate-pulse rounded-xl border border-border/40 bg-muted/10"
          style={{ minHeight }}
        />
      )}
    </div>
  )
}
