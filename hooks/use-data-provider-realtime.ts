'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import { clearAccountsCache, clearTradesCache } from '@/hooks/use-accounts'
import { invalidateQueriesForRealtimeChange } from '@/lib/realtime/invalidation'
import type { DatabaseChange, FreshnessState, RealtimeStatus } from '@/lib/realtime/types'
import type { QueryScope } from '@/lib/query/query-scope'

interface UseDataProviderRealtimeOptions {
  userId: string | undefined
  enabled: boolean
  queryClient: QueryClient
  scope: QueryScope
  reloadBootstrapData: () => void
}

type RefreshScope = 'trades' | 'accounts'
const DEGRADED_REFRESH_INTERVAL_MS = 60_000

function queryMatchesScope(queryKey: readonly unknown[], scope: QueryScope) {
  return queryKey.some((part) => {
    if (!part || typeof part !== 'object') return false
    const candidate = part as Partial<QueryScope>
    return candidate.surface === scope.surface && candidate.userId === scope.userId
  })
}

export function useDataProviderRealtime(options: UseDataProviderRealtimeOptions) {
  const { userId, enabled, queryClient, scope, reloadBootstrapData } = options
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('idle')
  const [freshness, setFreshness] = useState<FreshnessState>(() => ({
    source: 'unknown',
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'stale',
    updatedAt: null,
    staleSince: null,
  }))
  const degradedRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const stopDegradedRefresh = useCallback(() => {
    if (degradedRefreshIntervalRef.current) {
      clearInterval(degradedRefreshIntervalRef.current)
      degradedRefreshIntervalRef.current = null
    }
  }, [])

  const refreshDegradedData = useCallback(() => {
    if (!enabled || realtimeStatus !== 'degraded') return
    if (document.visibilityState !== 'visible' || !navigator.onLine) return

    void queryClient.invalidateQueries({
      type: 'active',
      predicate: (query) => queryMatchesScope(query.queryKey, scopeRef.current),
    })
    setFreshness((current) => ({ ...current, updatedAt: new Date() }))
  }, [enabled, queryClient, realtimeStatus])

  const handleStatusChange = useCallback((status: RealtimeStatus) => {
    if (status === 'connected') {
      stopDegradedRefresh()
      const now = new Date()
      setFreshness((current) => ({
        source: 'realtime',
        status: 'current',
        updatedAt: current.updatedAt ?? now,
        staleSince: null,
      }))
    } else if (status === 'degraded') {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      setFreshness((current) => ({
        ...current,
        source: offline ? 'cache' : 'polling',
        status: offline ? 'offline' : 'degraded',
        staleSince: current.staleSince ?? new Date(),
      }))
    } else if (status === 'disconnected' || status === 'error' || status === 'reconnecting') {
      stopDegradedRefresh()
      setFreshness((current) => ({
        ...current,
        source: 'cache',
        status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'stale',
        staleSince: current.staleSince ?? new Date(),
      }))
    }
    setRealtimeStatus(status)
  }, [stopDegradedRefresh])

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
    onAccountChange: (change) => scheduleRealtimeRefresh('accounts', change),
    onStatusChange: handleStatusChange,
  })

  useEffect(() => {
    stopDegradedRefresh()
    if (!enabled || realtimeStatus !== 'degraded') return
    if (document.visibilityState !== 'visible' || !navigator.onLine) return

    degradedRefreshIntervalRef.current = setInterval(refreshDegradedData, DEGRADED_REFRESH_INTERVAL_MS)
    return stopDegradedRefresh
  }, [enabled, realtimeStatus, refreshDegradedData, stopDegradedRefresh])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const restoreDegradedRefresh = () => {
      if (!enabled || realtimeStatus !== 'degraded') return
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      setFreshness((current) => ({ ...current, source: 'polling', status: 'degraded' }))
      refreshDegradedData()
      stopDegradedRefresh()
      degradedRefreshIntervalRef.current = setInterval(refreshDegradedData, DEGRADED_REFRESH_INTERVAL_MS)
    }
    const handleOffline = () => {
      stopDegradedRefresh()
      setFreshness((current) => ({ ...current, source: 'cache', status: 'offline' }))
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopDegradedRefresh()
        return
      }
      restoreDegradedRefresh()
    }

    window.addEventListener('online', restoreDegradedRefresh)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stopDegradedRefresh()
      window.removeEventListener('online', restoreDegradedRefresh)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, realtimeStatus, refreshDegradedData, stopDegradedRefresh])

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

  return freshness
}
