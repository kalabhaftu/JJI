'use client'

/**
 * ReconnectRefetcher
 *
 * Explicit safety net for the deliberate `refetchOnWindowFocus: false` setting
 * in lib/query/query-provider.tsx. Since we rely on Supabase Realtime for live
 * updates instead of focus-based refetches, we still need to catch the case
 * where the browser was fully offline (or the tab was hidden long enough that
 * the realtime socket did not cleanly resubscribe).
 *
 * Behavior:
 * - On `online` event → invalidate only *active* queries (queries actually
 *   mounted right now). Inactive/cached data is left alone.
 * - On tab becoming visible after being hidden for >30s → same.
 * - Uses React Query's own refetch flow, so widgets that read the query show
 *   their per-section skeleton (via `isFetching`) while existing data stays
 *   visible. No global loading state. No `window.location.reload()`.
 *
 * Explicitly not merged with `useDeploymentCheck` - that hook only reloads
 * when the /api/build-id endpoint reports a new build. Reconnect is a
 * different problem (stale data, not stale bundle) and must not trigger it.
 */

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
      // `type: 'active'` → only queries currently observed by mounted
      // components refetch. Cached-but-unused data stays put.
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
