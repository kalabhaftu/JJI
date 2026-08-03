'use client'


import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import logger from '@/lib/logger'

const HIDDEN_THRESHOLD_MS = 30_000

export function ReconnectRefetcher() {
  const queryClient = useQueryClient()
  const hiddenSinceRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const invalidateActive = (reason: string) => {


      queryClient.invalidateQueries({ type: 'active' })
      if (process.env.NODE_ENV !== 'production') {
        logger.debug({ reason }, 'Invalidated active queries after reconnect')
      }
    }

    const handleOnline = () => invalidateActive('online event')

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now()
        return
      }
      if (document.visibilityState === 'visible') {
        const hiddenAt = hiddenSinceRef.current
        hiddenSinceRef.current = null
        if (hiddenAt && Date.now() - hiddenAt > HIDDEN_THRESHOLD_MS) {
          invalidateActive('visible after long hide')
        }
      }
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [queryClient])

  return null
}
