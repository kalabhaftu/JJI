'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Measures the dashboard canvas after layout transitions and keeps the grid
 * width in sync with responsive container changes.
 */
export function useGridContainerWidth(isMobile = false) {
  const [width, setWidth] = useState(0)
  const [mounted, setMounted] = useState(false)
  const lastWidthRef = useRef(0)
  const observerRef = useRef<ResizeObserver | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    if (!node || isMobile) return

    const measure = () => {
      const nextWidth = node.offsetWidth
      if (nextWidth > 0 && nextWidth !== lastWidthRef.current) {
        lastWidthRef.current = nextWidth
        setWidth(nextWidth)
      }
      if (nextWidth > 0) setMounted(true)
    }

    const scheduleMeasure = () => requestAnimationFrame(measure)
    scheduleMeasure()

    observerRef.current = new ResizeObserver(scheduleMeasure)
    observerRef.current.observe(node)

    timersRef.current = [300, 600, 1200].map((delay) =>
      setTimeout(() => {
        scheduleMeasure()
        window.dispatchEvent(new Event('resize'))
      }, delay)
    )
  }, [isMobile])

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  return { width, containerRef, mounted: isMobile || mounted }
}
