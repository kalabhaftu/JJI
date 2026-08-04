'use client'

import { useCallback, useEffect, useRef } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import { clearAccountsCache, clearTradesCache } from '@/hooks/use-accounts'
import { invalidateQueriesForRealtimeChange } from '@/lib/realtime/invalidation'
import type { DatabaseChange } from '@/lib/realtime/types'
import type { QueryScope } from '@/lib/query/query-scope'

interface UseDataProviderRealtimeOptions {
  userId: string | undefined
  enabled: boolean
  queryClient: QueryClient
  scope: QueryScope
  reloadBootstrapData: () => void
}

type RefreshScope = 'trades' | 'accounts'

export function useDataProviderRealtime(options: UseDataProviderRealtimeOptions) {
  const { userId, enabled, queryClient, scope, reloadBootstrapData } = options

  const lastRealtimeRefreshRef = useRef<{ trades: number; accounts: number }>({
    trades: 0,
    accounts: 0
  })

  const realtimeRefreshTimeoutRef = useRef<{ trades: NodeJS.Timeout | null; accounts: NodeJS.Timeout | null }>({
    trades: null,
    accounts: null
  })

  const pendingChangesRef = useRef<{ trades: DatabaseChange | null; accounts: DatabaseChange | null }>({
    trades: null,
    accounts: null
  })

  const scopeRef = useRef(scope)
  scopeRef.current = scope

  const runRealtimeRefresh = useCallback((refreshScope: RefreshScope) => {
    const change = pendingChangesRef.current[refreshScope]
    pendingChangesRef.current[refreshScope] = null

    if (change) {
      void invalidateQueriesForRealtimeChange(queryClient, change, scopeRef.current)
    }

    if (refreshScope === 'trades') {
      clearTradesCache()
      queryClient.invalidateQueries({ queryKey: ['v1', 'trades'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['report-stats'] })
      queryClient.invalidateQueries({ queryKey: ['propfirm-stats'] })
      return
    }

    clearAccountsCache()
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['report-stats'] })
    queryClient.invalidateQueries({ queryKey: ['propfirm-stats'] })
    queryClient.invalidateQueries({ queryKey: ['v1', 'trades'] })
    reloadBootstrapData()
  }, [queryClient, reloadBootstrapData])

  const scheduleRealtimeRefresh = useCallback((refreshScope: RefreshScope, change: DatabaseChange) => {
    pendingChangesRef.current[refreshScope] = change

    if (realtimeRefreshTimeoutRef.current[refreshScope]) return

    const now = Date.now()
    const cooldown = refreshScope === 'trades' ? 500 : 1000
    const timeSinceLastRefresh = now - lastRealtimeRefreshRef.current[refreshScope]
    const delay = timeSinceLastRefresh < cooldown ? cooldown - timeSinceLastRefresh : 250

    realtimeRefreshTimeoutRef.current[refreshScope] = setTimeout(() => {
      realtimeRefreshTimeoutRef.current[refreshScope] = null
      lastRealtimeRefreshRef.current[refreshScope] = Date.now()
      runRealtimeRefresh(refreshScope)
    }, delay)
  }, [runRealtimeRefresh])

  useDatabaseRealtime({
    userId,
    enabled,
    onTradeChange: (change) => scheduleRealtimeRefresh('trades', change),
    onAccountChange: (change) => scheduleRealtimeRefresh('accounts', change)
  })

  useEffect(() => {
    const timeouts = realtimeRefreshTimeoutRef.current

    return () => {
      if (timeouts.trades) {
        clearTimeout(timeouts.trades)
        timeouts.trades = null
      }
      if (timeouts.accounts) {
        clearTimeout(timeouts.accounts)
        timeouts.accounts = null
      }
    }
  }, [])
}
