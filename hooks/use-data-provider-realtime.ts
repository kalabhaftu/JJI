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
    // Trade updates should only touch trade/report query domains.
    if (scope === 'trades') {
      clearTradesCache()
      queryClient.invalidateQueries({ queryKey: ['v1', 'trades'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['report-stats'] })
      queryClient.invalidateQueries({ queryKey: ['propfirm-stats'] })
      return
    }

    // Account-level changes require bootstrap reload for account store consumers,
    // plus targeted stats invalidation.
    clearAccountsCache()
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['report-stats'] })
    queryClient.invalidateQueries({ queryKey: ['propfirm-stats'] })
    queryClient.invalidateQueries({ queryKey: ['v1', 'trades'] })
    reloadBootstrapData()
  }, [queryClient, reloadBootstrapData])

  const scheduleRealtimeRefresh = useCallback((scope: RefreshScope) => {
    const now = Date.now()
    const cooldown = scope === 'trades' ? 500 : 1000
    const timeSinceLastRefresh = now - lastRealtimeRefreshRef.current[scope]

    if (timeSinceLastRefresh < cooldown) {
      if (realtimeRefreshTimeoutRef.current[scope]) {
        clearTimeout(realtimeRefreshTimeoutRef.current[scope] as NodeJS.Timeout)
      }

      realtimeRefreshTimeoutRef.current[scope] = setTimeout(() => {
        lastRealtimeRefreshRef.current[scope] = Date.now()
        runRealtimeRefresh(scope)
      }, cooldown - timeSinceLastRefresh)
      return
    }

    setTimeout(() => {
      lastRealtimeRefreshRef.current[scope] = Date.now()
      runRealtimeRefresh(scope)
    }, 250)
  }, [runRealtimeRefresh])

  useDatabaseRealtime({
    userId,
    enabled,
    onTradeChange: () => scheduleRealtimeRefresh('trades'),
    onAccountChange: () => scheduleRealtimeRefresh('accounts')
  })

  useEffect(() => {
    const tradesTimeout = realtimeRefreshTimeoutRef.current.trades
    const accountsTimeout = realtimeRefreshTimeoutRef.current.accounts

    return () => {
      if (tradesTimeout) {
        clearTimeout(tradesTimeout)
      }
      if (accountsTimeout) {
        clearTimeout(accountsTimeout)
      }
    }
  }, [])
}
