'use client'

import { useCallback } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { type InferSelectModel } from 'drizzle-orm'
import { Trade as schemaTrade } from '@/lib/db/schema'

type PrismaTrade = InferSelectModel<typeof schemaTrade>
import { apiRequest } from '@/lib/api/client'
import { queryKeyPrefixes } from '@/lib/query/query-keys'

interface UseDataProviderTradeMutationsParams {
  userId: string | undefined
  queryClient: QueryClient
}

export interface TradeMutationContext {
  snapshots: Array<{ queryKey: readonly unknown[]; data: unknown }>
}

export function useDataProviderTradeMutations({
  userId,
  queryClient,
}: UseDataProviderTradeMutationsParams) {
  const scope = userId ? { surface: 'authenticated' as const, userId } : null
  const tradeQueryPrefix = scope ? queryKeyPrefixes.trades(scope) : null

  const snapshotTradeQueries = (): TradeMutationContext => {
    const snapshots: TradeMutationContext['snapshots'] = []
    if (!tradeQueryPrefix) return { snapshots }
    queryClient.getQueriesData({ queryKey: tradeQueryPrefix }).forEach(([queryKey, data]) => {
      if (data !== undefined) snapshots.push({ queryKey: queryKey as readonly unknown[], data })
    })
    return { snapshots }
  }

  const restoreTradeQueries = (context: TradeMutationContext) => {
    context.snapshots.forEach(({ queryKey, data }) => {
      queryClient.setQueriesData({ queryKey: queryKey as any }, data)
    })
  }

  const updateTrades = useCallback(async (tradeIds: string[], update: Partial<PrismaTrade>) => {
    if (!userId || !tradeQueryPrefix) return

    const applyTradePatch = (trade: PrismaTrade) =>
      tradeIds.includes(trade.id) ? { ...trade, ...update } : trade

    const patchCalendarData = (calendarData: any) => {
      if (!calendarData || typeof calendarData !== 'object') return calendarData

      const nextCalendarData: Record<string, any> = { ...calendarData }

      Object.keys(nextCalendarData).forEach((key) => {
        const day = nextCalendarData[key]
        if (!day || !Array.isArray(day.trades)) return
        nextCalendarData[key] = {
          ...day,
          trades: day.trades.map((trade: PrismaTrade) => applyTradePatch(trade)),
        }
      })

      return nextCalendarData
    }

    const mutationContext = snapshotTradeQueries()

    queryClient.setQueriesData({ queryKey: tradeQueryPrefix }, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData.trades)) return oldData

      return {
        ...oldData,
        trades: oldData.trades.map((trade: PrismaTrade) => applyTradePatch(trade)),
        calendarData: patchCalendarData(oldData.calendarData),
        widgets: oldData.widgets
          ? {
              ...oldData.widgets,
              calendarData: patchCalendarData(oldData.widgets.calendarData),
            }
          : oldData.widgets,
      }
    })

    try {
      const response = await apiRequest<{ updated: number }>('/api/v1/trades/batch/update', {
        method: 'POST',
        body: JSON.stringify({ tradeIds, update }),
      })
      const updatedCount = response.data?.updated ?? 0
      if (updatedCount < tradeIds.length) {
        throw new Error('Trade update did not save. Refresh and try again.')
      }
      await queryClient.invalidateQueries({ queryKey: tradeQueryPrefix })
    } catch (error) {
      restoreTradeQueries(mutationContext)
      await queryClient.invalidateQueries({ queryKey: tradeQueryPrefix })
      throw error
    }
  }, [userId, queryClient, tradeQueryPrefix])

  const groupTrades = useCallback(async (tradeIds: string[]) => {
    if (!userId || !tradeQueryPrefix) return

    await apiRequest('/api/v1/trades/batch/group', {
      method: 'POST',
      body: JSON.stringify({ tradeIds }),
    })
    await queryClient.invalidateQueries({ queryKey: tradeQueryPrefix })
  }, [userId, queryClient, tradeQueryPrefix])

  const ungroupTrades = useCallback(async (tradeIds: string[]) => {
    if (!userId || !tradeQueryPrefix) return

    await apiRequest('/api/v1/trades/batch/ungroup', {
      method: 'POST',
      body: JSON.stringify({ tradeIds }),
    })
    await queryClient.invalidateQueries({ queryKey: tradeQueryPrefix })
  }, [userId, queryClient, tradeQueryPrefix])

  const appendTagsToTrades = useCallback(async (tradeIds: string[], tagIds: string[]) => {
    if (!userId || !tradeQueryPrefix) return

    const applyTagAppend = (trade: PrismaTrade) => {
      if (!tradeIds.includes(trade.id)) return trade
      const existingTags = Array.isArray(trade.tags) ? trade.tags : []
      const nextTags = Array.from(new Set([...existingTags, ...tagIds]))
      return { ...trade, tags: nextTags }
    }

    const patchCalendarData = (calendarData: any) => {
      if (!calendarData || typeof calendarData !== 'object') return calendarData

      const nextCalendarData: Record<string, any> = { ...calendarData }

      Object.keys(nextCalendarData).forEach((key) => {
        const day = nextCalendarData[key]
        if (!day || !Array.isArray(day.trades)) return
        nextCalendarData[key] = {
          ...day,
          trades: day.trades.map((trade: PrismaTrade) => applyTagAppend(trade)),
        }
      })

      return nextCalendarData
    }

    const mutationContext = snapshotTradeQueries()

    queryClient.setQueriesData({ queryKey: tradeQueryPrefix }, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData.trades)) return oldData

      return {
        ...oldData,
        trades: oldData.trades.map((trade: PrismaTrade) => applyTagAppend(trade)),
        calendarData: patchCalendarData(oldData.calendarData),
        widgets: oldData.widgets
          ? {
              ...oldData.widgets,
              calendarData: patchCalendarData(oldData.widgets.calendarData),
            }
          : oldData.widgets,
      }
    })

    try {
      await apiRequest('/api/v1/trades/batch/tag', {
        method: 'POST',
        body: JSON.stringify({ tradeIds, tags: tagIds, mode: 'append' }),
      })
      await queryClient.invalidateQueries({ queryKey: tradeQueryPrefix })
    } catch (error) {
      restoreTradeQueries(mutationContext)
      await queryClient.invalidateQueries({ queryKey: tradeQueryPrefix })
      throw error
    }
  }, [userId, queryClient, tradeQueryPrefix])

  return {
    updateTrades,
    groupTrades,
    ungroupTrades,
    appendTagsToTrades,
  }
}
