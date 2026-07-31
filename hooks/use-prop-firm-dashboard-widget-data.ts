"use client"

import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useDashboardPropFirmAccount } from './use-dashboard-prop-firm-account'

type PropFirmTrade = {
  id: string
  pnl?: number | string | null
  commission?: number | string | null
  netPnL?: number | string | null
  instrument?: string | null
  symbol?: string | null
  side?: string | null
  entryDate?: string | Date | null
  closeDate?: string | Date | null
  entryTime?: string | Date | null
  exitTime?: string | Date | null
}

type PropFirmWidgetData = {
  account: any | null
  drawdown: any | null
  statistics: any | null
  trades: PropFirmTrade[]
  todayStats: {
    pnl: number
    trades: number
    wins: number
    losses: number
    breakeven: number
    winRate: number
    bestTrade: number
    worstTrade: number
    averageTrade: number
  }
  accountExtremes: {
    bestTrade: number
    worstTrade: number
    averageTrade: number
  }
  dailyDrawdown: {
    dailyStartBalance: number
    dailyDrawdownUsed: number
    dailyDrawdownRemaining: number
    dailyLossFloor: number
    dailyLimit: number
    isBreached?: boolean
    breachType?: string
    notes?: string
  }
  resetTimezone: string
  groupedTradeCount: number
  growth: Array<{
    label: string
    timestamp: number
    balance: number
    pnl: number
    tradePnl: number
  }>
  peakEquity: number
  maxDrawdown: number
  tradingDays: number
}

interface PropFirmCacheEntry {
  accountPayload: any | null
  trades: PropFirmTrade[]
  isLoading: boolean
  error: string | null
  promise?: Promise<void> | null
}

interface PropFirmStore {
  cache: Record<string, PropFirmCacheEntry>
  fetchData: (id: string, resetTimezone?: string) => Promise<void>
  clearCache: () => void
}

export function getPropFirmCacheKey(id: string | null | undefined, resetTimezone = 'UTC') {
  return id ? `${id}:${resetTimezone || 'UTC'}` : ''
}

export const usePropFirmStore = create<PropFirmStore>((set, get) => ({
  cache: {},
  clearCache: () => set({ cache: {} }),
  fetchData: async (id: string, resetTimezone = 'UTC') => {
    const cacheKey = getPropFirmCacheKey(id, resetTimezone)
    const entry = get().cache[cacheKey]
    if (entry && (entry.isLoading || entry.promise || entry.accountPayload)) {
      if (entry.promise) {
        await entry.promise
      }
      return
    }

    let resolvePromise: () => void = () => {}
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })

    set((state) => ({
      cache: {
        ...state.cache,
        [cacheKey]: {
          accountPayload: null,
          trades: [],
          isLoading: true,
          error: null,
          promise,
        },
      },
    }))

    try {
      const params = new URLSearchParams({ resetTimezone })
      const accountResponse = await fetch(`/api/v1/prop-firm/accounts/${id}?${params.toString()}`)
      const accountJson = await accountResponse.json()
      if (!accountResponse.ok || !accountJson.success) throw new Error(accountJson.error || 'Failed to load prop firm account')

      set((state) => ({
        cache: {
          ...state.cache,
          [cacheKey]: {
            accountPayload: accountJson.data,
            trades: [],
            isLoading: false,
            error: null,
            promise: null,
          },
        },
      }))
    } catch (err) {
      set((state) => ({
        cache: {
          ...state.cache,
          [cacheKey]: {
            accountPayload: null,
            trades: [],
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to load prop firm widget data',
            promise: null,
          },
        },
      }))
    } finally {
      resolvePromise()
    }
  },
}))

export function usePropFirmDashboardWidgetData() {
  const selection = useDashboardPropFirmAccount()
  const id = selection.selectedMasterAccountId
  const resetTimezone = selection.resetTimezone || 'UTC'

  const cacheKey = getPropFirmCacheKey(id, resetTimezone)
  const cacheEntry = usePropFirmStore((state) => state.cache[cacheKey])
  const fetchData = usePropFirmStore((state) => state.fetchData)

  useEffect(() => {
    if (id) {
      fetchData(id, resetTimezone)
    }
  }, [id, resetTimezone, fetchData])

  const accountPayload = cacheEntry?.accountPayload ?? null
  const emptyTrades = useMemo(() => [], [])
  const trades = cacheEntry?.trades ?? emptyTrades
  const isDataLoading = id ? (!cacheEntry || cacheEntry.isLoading) : false
  const dataError = cacheEntry?.error ?? null

  const computed = useMemo(() => {
    const account = accountPayload?.account ?? null
    const widgetMetrics = accountPayload?.widgetMetrics ?? {}

    return {
      account,
      drawdown: accountPayload?.drawdown ?? null,
      statistics: accountPayload?.statistics ?? null,
      trades,
      accountExtremes: widgetMetrics.accountExtremes ?? { bestTrade: 0, worstTrade: 0, averageTrade: 0 },
      dailyDrawdown: widgetMetrics.dailyDrawdown ?? {
        dailyStartBalance: 0,
        dailyDrawdownUsed: 0,
        dailyDrawdownRemaining: 0,
        dailyLossFloor: 0,
        dailyLimit: 0,
      },
      resetTimezone: widgetMetrics.resetTimezone ?? resetTimezone,
      groupedTradeCount: widgetMetrics.groupedTradeCount ?? 0,
      todayStats: widgetMetrics.todayStats ?? {
        pnl: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        winRate: 0,
        bestTrade: 0,
        worstTrade: 0,
        averageTrade: 0,
      },
      growth: widgetMetrics.growth ?? [],
      peakEquity: widgetMetrics.peakEquity ?? Number(account?.accountSize || 0),
      maxDrawdown: widgetMetrics.maxDrawdown ?? 0,
      tradingDays: widgetMetrics.tradingDays ?? 0,
    } satisfies PropFirmWidgetData
  }, [accountPayload, trades, resetTimezone])

  return {
    ...selection,
    data: computed,
    isLoading: selection.isLoading || isDataLoading,
    error: selection.error || dataError,
  }
}
