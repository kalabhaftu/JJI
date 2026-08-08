"use client"

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
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

export type PropFirmNumeric = number | string | null | undefined

export type PropFirmPhase = {
  phaseNumber?: PropFirmNumeric
  status?: string | null
  profitTargetPercent?: PropFirmNumeric
  dailyDrawdownPercent?: PropFirmNumeric
  maxDrawdownPercent?: PropFirmNumeric
  maxDrawdownType?: string | null
}

export type PropFirmAccount = {
  accountSize?: PropFirmNumeric
  currentPhase?: PropFirmPhase | null
  currentPhaseNumber?: PropFirmNumeric
  currentBalance?: PropFirmNumeric
  currentEquity?: PropFirmNumeric
  currentGrossPnL?: PropFirmNumeric
  currentNetPnL?: PropFirmNumeric
  profitTargetProgress?: PropFirmNumeric
  dailyDrawdownRemaining?: PropFirmNumeric
  maxDrawdownRemaining?: PropFirmNumeric
  status?: string | null
}

export type PropFirmStatistics = Record<string, PropFirmNumeric>

export type PropFirmDrawdown = {
  dailyDrawdownRemaining?: PropFirmNumeric
  maxDrawdownRemaining?: PropFirmNumeric
}

type PropFirmWidgetMetrics = {
  accountExtremes?: PropFirmWidgetData['accountExtremes']
  dailyDrawdown?: PropFirmWidgetData['dailyDrawdown']
  todayStats?: PropFirmWidgetData['todayStats']
  growth?: PropFirmWidgetData['growth']
  resetTimezone?: string
  groupedTradeCount?: number
  peakEquity?: number
  maxDrawdown?: number
  tradingDays?: number
}

export type PropFirmAccountPayload = {
  account?: PropFirmAccount | null
  drawdown?: PropFirmDrawdown | null
  statistics?: PropFirmStatistics | null
  widgetMetrics?: PropFirmWidgetMetrics
}

export type PropFirmWidgetData = {
  account: PropFirmAccount | null
  drawdown: PropFirmDrawdown | null
  statistics: PropFirmStatistics | null
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

export function usePropFirmDashboardWidgetData(enabled = true) {
  const selection = useDashboardPropFirmAccount()
  const id = selection.selectedMasterAccountId
  const resetTimezone = selection.resetTimezone || 'UTC'

  const scope = useQueryScope()
  const query = useQuery({
    queryKey: queryKeys.propFirmAccount(scope, id ?? '', { resetTimezone }),
    queryFn: ({ signal }) =>
      apiRequestData<PropFirmAccountPayload>(
        `/api/v1/prop-firm/accounts/${id}?${new URLSearchParams({ resetTimezone }).toString()}`,
        {
          signal,
          operation: 'load-prop-firm-account-widget-data',
        }
      ),
    enabled: enabled && isScopeReady(scope) && Boolean(id),
    staleTime: 30_000,
  })

  const accountPayload = query.data ?? null
  const emptyTrades = useMemo(() => [], [])
  const trades = emptyTrades
  const isDataLoading = query.isLoading
  const dataError = query.error ? (query.error instanceof Error ? query.error.message : 'Failed to load prop firm widget data') : null

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
