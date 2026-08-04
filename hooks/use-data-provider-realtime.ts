'use client'

import { useCallback, useEffect, useRef } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import { clearAccountsCache, clearTradesCache } from '@/hooks/use-accounts'

interface UseDataProviderRealtimeOptions {
  userId: string | undefined
  enabled: boolean
  queryClient: QueryClient
  reloadBootstrapData: () => void
}

type RefreshScope = 'trades' | 'accounts'

export function useDataProviderRealtime(options: UseDataProviderRealtimeOptions) {
  const { userId, enabled, queryClient, reloadBootstrapData } = options

  const lastRealtimeRefreshRef = useRef<{ trades: number; accounts: number }>({
    trades: 0,
    accounts: 0
  })

  const realtimeRefreshTimeoutRef = useRef<{ trades: NodeJS.Timeout | null; accounts: NodeJS.Timeout | null }>({
    trades: null,
    accounts: null
  })

  const runRealtimeRefresh = useCallback((scope: RefreshScope) => {

    if (scope === 'trades') {
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

  const scheduleRealtimeRefresh = useCallback((scope: RefreshScope) => {
    if (realtimeRefreshTimeoutRef.current[scope]) return

    const now = Date.now()
    const cooldown = scope === 'trades' ? 500 : 1000
    const timeSinceLastRefresh = now - lastRealtimeRefreshRef.current[scope]
    const delay = timeSinceLastRefresh < cooldown ? cooldown - timeSinceLastRefresh : 250

    realtimeRefreshTimeoutRef.current[scope] = setTimeout(() => {
      realtimeRefreshTimeoutRef.current[scope] = null
      lastRealtimeRefreshRef.current[scope] = Date.now()
      runRealtimeRefresh(scope)
    }, delay)
  }, [runRealtimeRefresh])

  useDatabaseRealtime({
    userId,
    enabled,
    onTradeChange: () => scheduleRealtimeRefresh('trades'),
    onAccountChange: () => scheduleRealtimeRefresh('accounts')
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
