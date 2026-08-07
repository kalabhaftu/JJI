'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { recoverDatabaseRealtimeOnce, useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import { getRealtimeInvalidationMap, invalidateQueriesForRealtimeChange } from '@/lib/realtime/invalidation'
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
type ReconciliationMode = 'connected' | 'degraded'
const DEGRADED_REFRESH_INTERVAL_MS = 60_000
const CANONICAL_SCOPE_INDEX = new Map<string, number>([
  ['accounts', 1],
  ['trades', 1],
  ['journal', 1],
  ['tags', 1],
  ['templates', 1],
  ['reports', 2],
  ['notifications', 1],
  ['prop-firm', 2],
  ['settings', 1],
  ['goals', 1],
  ['playbook', 1],
  ['backtests', 1],
  ['synchronizations', 1],
])

function queryMatchesScope(queryKey: readonly unknown[], scope: QueryScope) {
  const scopeIndex = typeof queryKey[0] === 'string' ? CANONICAL_SCOPE_INDEX.get(queryKey[0]) : undefined
  if (scopeIndex === undefined) return false
  const candidate = queryKey[scopeIndex]
  if (!candidate || typeof candidate !== 'object') return false
  const queryScope = candidate as Partial<QueryScope>
  return queryScope.surface === scope.surface && queryScope.userId === scope.userId
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
  const degradedRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconciliationInFlightRef = useRef(false)
  const pendingReconciliationRef = useRef<ReconciliationMode | null>(null)
  const requestReconciliationRef = useRef<(mode: ReconciliationMode) => void>(() => undefined)
  const restorationAttemptedRef = useRef(false)
  const mountedRef = useRef(true)
  const lifecycleRef = useRef({ enabled, status: realtimeStatus, scope, generation: 0 })
  const previousLifecycleRef = useRef({ enabled, status: realtimeStatus, scopeKey: JSON.stringify(scope) })
  const scopeKey = JSON.stringify(scope)
  if (
    previousLifecycleRef.current.enabled !== enabled ||
    previousLifecycleRef.current.scopeKey !== scopeKey
  ) {
    lifecycleRef.current.generation++
    previousLifecycleRef.current = { enabled, status: realtimeStatus, scopeKey }
  }
  lifecycleRef.current.enabled = enabled
  lifecycleRef.current.status = realtimeStatus
  lifecycleRef.current.scope = scope

  const lastRealtimeRefreshRef = useRef<{ trades: number; accounts: number }>({
    trades: 0,
    accounts: 0
  })

  const realtimeRefreshTimeoutRef = useRef<{ trades: NodeJS.Timeout | null; accounts: NodeJS.Timeout | null }>({
    trades: null,
    accounts: null
  })

  const pendingChangesRef = useRef<{ trades: DatabaseChange[]; accounts: DatabaseChange[] }>({
    trades: [],
    accounts: []
  })

  const scopeRef = useRef(scope)
  scopeRef.current = scope

  const stopDegradedRefresh = useCallback(() => {
    if (degradedRefreshTimeoutRef.current) {
      clearTimeout(degradedRefreshTimeoutRef.current)
      degradedRefreshTimeoutRef.current = null
    }
  }, [])

  const requestReconciliation = useCallback((mode: ReconciliationMode) => {
    const lifecycle = lifecycleRef.current
    const hasAuthenticatedScope = lifecycle.scope.surface === 'authenticated' && Boolean(lifecycle.scope.userId) && lifecycle.scope.userId === userId
    if (!lifecycle.enabled || !hasAuthenticatedScope || lifecycle.status !== mode) return
    if (mode === 'degraded' && (document.visibilityState !== 'visible' || !navigator.onLine)) return

    if (reconciliationInFlightRef.current) {
      if (mode === 'connected' || pendingReconciliationRef.current !== 'connected') {
        pendingReconciliationRef.current = mode
      }
      return
    }

    reconciliationInFlightRef.current = true
    const generation = lifecycle.generation
    const reconciliationScope = lifecycle.scope

    void (async () => {
      try {
        const matchingActiveQueries = queryClient.getQueryCache().findAll({
          type: 'active',
          predicate: (query) => queryMatchesScope(query.queryKey, reconciliationScope),
        })
        if (matchingActiveQueries.length === 0) return
        const previousUpdateTimes = new Map(
          matchingActiveQueries.map((query) => [query.queryHash, query.state.dataUpdatedAt]),
        )

        await queryClient.invalidateQueries({
          type: 'active',
          refetchType: 'active',
          predicate: (query) => queryMatchesScope(query.queryKey, reconciliationScope),
        }, { throwOnError: true })

        const refreshedActiveQuery = queryClient.getQueryCache().findAll({
          type: 'active',
          predicate: (query) => {
            const previousUpdateTime = previousUpdateTimes.get(query.queryHash)
            return previousUpdateTime !== undefined && query.state.dataUpdatedAt > previousUpdateTime
          },
        }).length > 0
        if (!refreshedActiveQuery) return

        const currentLifecycle = lifecycleRef.current
        if (
          currentLifecycle.generation !== generation ||
          !mountedRef.current ||
          !currentLifecycle.enabled ||
          currentLifecycle.status !== mode ||
          JSON.stringify(currentLifecycle.scope) !== JSON.stringify(reconciliationScope)
        ) return

        const now = new Date()
        setFreshness((current) => mode === 'connected'
          ? { source: 'realtime', status: 'current', updatedAt: now, staleSince: null }
          : { ...current, updatedAt: now })
      } catch {
        // Keep stale freshness; a later bounded reconciliation can retry.
      } finally {
        reconciliationInFlightRef.current = false
        const pendingMode = pendingReconciliationRef.current
        pendingReconciliationRef.current = null
        if (pendingMode) {
          requestReconciliationRef.current(pendingMode)
          return
        }

        const currentLifecycle = lifecycleRef.current
        if (
          currentLifecycle.enabled &&
          currentLifecycle.status === 'degraded' &&
          currentLifecycle.scope.surface === 'authenticated' &&
          currentLifecycle.scope.userId === userId &&
          document.visibilityState === 'visible' &&
          navigator.onLine
        ) {
          stopDegradedRefresh()
          degradedRefreshTimeoutRef.current = setTimeout(
            () => requestReconciliationRef.current('degraded'),
            DEGRADED_REFRESH_INTERVAL_MS,
          )
        }
      }
    })()
  }, [queryClient, stopDegradedRefresh, userId])
  requestReconciliationRef.current = requestReconciliation

  const handleStatusChange = useCallback((status: RealtimeStatus) => {
    lifecycleRef.current.status = status
    lifecycleRef.current.generation++
    if (status === 'connected') {
      restorationAttemptedRef.current = false
      stopDegradedRefresh()
      pendingReconciliationRef.current = null
      const activePrivateQueries = queryClient.getQueryCache().findAll({
        type: 'active',
        predicate: (query) => queryMatchesScope(query.queryKey, scopeRef.current),
      })
      setFreshness((current) => ({
        ...current,
        source: activePrivateQueries.length > 0 ? 'realtime' : 'unknown',
        status: 'stale',
        staleSince: current.staleSince ?? new Date(),
      }))
      requestReconciliationRef.current('connected')
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
  }, [queryClient, stopDegradedRefresh])

  const runRealtimeRefresh = useCallback((refreshScope: RefreshScope) => {
    const changes = pendingChangesRef.current[refreshScope]
    pendingChangesRef.current[refreshScope] = []

    if (changes.length > 0) {
      void invalidateQueriesForRealtimeChange(queryClient, changes, scopeRef.current)
      if (changes.some((change) => getRealtimeInvalidationMap(change.table)?.mode === 'refresh-bootstrap')) {
        reloadBootstrapData()
      }
    }
  }, [queryClient, reloadBootstrapData])

  const scheduleRealtimeRefresh = useCallback((refreshScope: RefreshScope, change: DatabaseChange) => {
    pendingChangesRef.current[refreshScope].push(change)

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
    onSynchronizationChange: (change) => {
      void invalidateQueriesForRealtimeChange(queryClient, change, scopeRef.current)
      if (getRealtimeInvalidationMap(change.table)?.mode === 'refresh-bootstrap') {
        reloadBootstrapData()
      }
    },
    onStatusChange: handleStatusChange,
  })

  useEffect(() => {
    stopDegradedRefresh()
    const hasAuthenticatedScope = scope.surface === 'authenticated' && Boolean(scope.userId) && scope.userId === userId
    if (!enabled || !hasAuthenticatedScope || realtimeStatus !== 'degraded') return
    if (document.visibilityState !== 'visible' || !navigator.onLine) return

    degradedRefreshTimeoutRef.current = setTimeout(
      () => requestReconciliationRef.current('degraded'),
      DEGRADED_REFRESH_INTERVAL_MS,
    )
    return stopDegradedRefresh
  }, [enabled, realtimeStatus, scope, stopDegradedRefresh, userId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasAuthenticatedScope = scope.surface === 'authenticated' && Boolean(scope.userId) && scope.userId === userId
    if (!enabled || !hasAuthenticatedScope || realtimeStatus !== 'degraded') return

    const restoreDegradedRefresh = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      setFreshness((current) => ({ ...current, source: 'polling', status: 'degraded' }))
      stopDegradedRefresh()
      requestReconciliationRef.current('degraded')
      if (!restorationAttemptedRef.current) {
        restorationAttemptedRef.current = true
        recoverDatabaseRealtimeOnce()
      }
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
  }, [enabled, realtimeStatus, scope, stopDegradedRefresh, userId])

  useEffect(() => {
    mountedRef.current = true
    const timeouts = realtimeRefreshTimeoutRef.current
    const lifecycle = lifecycleRef.current

    return () => {
      mountedRef.current = false
      lifecycle.generation++
      pendingReconciliationRef.current = null
      stopDegradedRefresh()
      if (timeouts.trades) {
        clearTimeout(timeouts.trades)
        timeouts.trades = null
      }
      if (timeouts.accounts) {
        clearTimeout(timeouts.accounts)
        timeouts.accounts = null
      }
    }
  }, [stopDegradedRefresh])

  return freshness
}
