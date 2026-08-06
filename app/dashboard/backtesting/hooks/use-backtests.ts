'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiRequest, apiRequestData, ApiClientError } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
import { reportClientError } from '@/lib/observability/report-error'
import type { BacktestDirection, BacktestModel, BacktestOutcome, BacktestSession, BacktestTrade } from '@/types/backtesting-types'

interface RawBacktest {
  id: string
  pair: string
  direction: string
  outcome: string
  session: string
  model: string
  customModel?: string | null
  riskRewardRatio: number
  riskPoints: number
  rewardPoints: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
  exitPrice: number
  pnl: number
  imageOne?: string | null
  imageTwo?: string | null
  imageThree?: string | null
  imageFour?: string | null
  imageFive?: string | null
  imageSix?: string | null
  cardPreviewImage?: string | null
  notes?: string | null
  tags?: string[] | null
  dateExecuted: string
  backtestDate?: string | null
  createdAt: string
  updatedAt: string
}

function transformBacktest(bt: RawBacktest): BacktestTrade {
  return {
    id: bt.id,
    pair: bt.pair,
    direction: bt.direction as BacktestDirection,
    outcome: bt.outcome as BacktestOutcome,
    session: bt.session as BacktestSession,
    model: bt.model as BacktestModel,
    ...(bt.customModel ? { customModel: bt.customModel } : {}),
    riskRewardRatio: bt.riskRewardRatio,
    riskPoints: bt.riskPoints,
    rewardPoints: bt.rewardPoints,
    entryPrice: bt.entryPrice,
    stopLoss: bt.stopLoss,
    takeProfit: bt.takeProfit,
    exitPrice: bt.exitPrice,
    pnl: bt.pnl,
    images: [
      bt.imageOne,
      bt.imageTwo,
      bt.imageThree,
      bt.imageFour,
      bt.imageFive,
      bt.imageSix,
    ].filter((url): url is string => Boolean(url)),
    ...(bt.cardPreviewImage ? { cardPreviewImage: bt.cardPreviewImage } : {}),
    ...(bt.notes ? { notes: bt.notes } : {}),
    ...(bt.tags ? { tags: bt.tags } : {}),
    dateExecuted: new Date(bt.dateExecuted),
    ...(bt.backtestDate ? { backtestDate: new Date(bt.backtestDate) } : {}),
    createdAt: new Date(bt.createdAt),
    updatedAt: new Date(bt.updatedAt),
  }
}

export function useBacktests(
  initialBacktests: BacktestTrade[],
  isDemoMode: boolean | undefined,
) {
  const scope = useQueryScope()
  const queryClient = useQueryClient()
  const enabled = !isDemoMode && isScopeReady(scope)

  const query = useQuery<BacktestTrade[]>({
    queryKey: queryKeys.backtests(scope),
    queryFn: async () => {
      const data = await apiRequestData<{ backtests?: RawBacktest[] } | null>(
        '/api/v1/backtesting',
        { timeoutMs: 10_000, operation: 'load-backtests' },
      )
      return Array.isArray(data?.backtests) ? data.backtests.map(transformBacktest) : []
    },
    enabled,
    initialData: initialBacktests,
    staleTime: 30_000,
  })

  const backtests = query.data ?? []

  const loadErrorToastShown = useRef(false)
  useEffect(() => {
    if (query.error && !loadErrorToastShown.current) {
      loadErrorToastShown.current = true
      if (
        query.error instanceof ApiClientError &&
        (query.error.kind === 'timeout' || query.error.kind === 'cancelled')
      ) {
        return
      }
      reportClientError(query.error, { operation: 'load-backtests', route: '/dashboard/backtesting' })
      toast.error('Failed to load backtests')
    }
  }, [query.error])

  const refetchBacktests = () => {
    void query.refetch()
  }

  const prependBacktest = (backtest: BacktestTrade) => {
    queryClient.setQueryData(queryKeys.backtests(scope), (prev: BacktestTrade[] | undefined) => [
      backtest,
      ...(prev ?? []),
    ])
  }

  const patchBacktest = (id: string, patch: Partial<BacktestTrade>) => {
    queryClient.setQueryData(queryKeys.backtests(scope), (prev: BacktestTrade[] | undefined) =>
      (prev ?? []).map((backtest) => (backtest.id === id ? { ...backtest, ...patch } : backtest)),
    )
  }

  const removeBacktest = (id: string) => {
    queryClient.setQueryData(queryKeys.backtests(scope), (prev: BacktestTrade[] | undefined) =>
      (prev ?? []).filter((backtest) => backtest.id !== id),
    )
  }

  const createBacktest = async (input: Record<string, unknown>) => {
    const response = await apiRequest<{ backtest?: RawBacktest }>('/api/v1/backtesting', {
      method: 'POST',
      body: JSON.stringify(input),
      retry: { mode: 'never' },
      operation: 'create-backtest',
    })
    if (response.data?.backtest) {
      prependBacktest(transformBacktest(response.data.backtest))
    }
  }

  const updateBacktest = async (id: string, input: Record<string, unknown>) => {
    const response = await apiRequest<{ backtest?: RawBacktest }>('/api/v1/backtesting', {
      method: 'PUT',
      body: JSON.stringify({ id, ...input }),
      retry: { mode: 'never' },
      operation: 'update-backtest',
    })
    if (response.data?.backtest) {
      patchBacktest(id, transformBacktest(response.data.backtest))
    }
  }

  const deleteBacktest = async (id: string) => {
    await apiRequest(`/api/v1/backtesting?id=${id}`, {
      method: 'DELETE',
      retry: { mode: 'never' },
      operation: 'delete-backtest',
    })
    removeBacktest(id)
  }

  return {
    backtests,
    isLoading: query.isLoading,
    refetchBacktests,
    createBacktest,
    updateBacktest,
    deleteBacktest,
    prependBacktest,
    patchBacktest,
    removeBacktest,
  }
}
