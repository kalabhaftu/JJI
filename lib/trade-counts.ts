import type { TradeType } from '@/lib/db/schema/trades';

import { groupTradesByExecution, type GroupedTrade } from '@/lib/utils'

type Trade = TradeType;

export const TRADE_COUNT_SELECT = {
  id: true,
  userId: true,
  accountNumber: true,
  phaseAccountId: true,
  instrument: true,
  symbol: true,
  side: true,
  entryId: true,
  groupId: true,
  pnl: true,
  commission: true,
  quantity: true,
  timeInPosition: true,
  entryDate: true,
  closeDate: true,
  entryTime: true,
  exitTime: true,
  entryPrice: true,
  closePrice: true,
  stopLoss: true,
  takeProfit: true,
} satisfies Partial<Record<keyof Trade, boolean>>

function incrementCount(map: Map<string, number>, key: string | null | undefined) {
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + 1)
}

export interface GroupedTradeCountSummary {
  rawTradeRowCount: number
  groupedTradeCount: number
  partialExecutionGroupCount: number
  groupedTrades: GroupedTrade[]
  groupedCountByAccountNumber: Map<string, number>
  groupedCountByLiveAccountNumber: Map<string, number>
  groupedCountByPhaseAccountId: Map<string, number>
}

export function buildGroupedTradeCountSummary(trades: Array<Trade | any>): GroupedTradeCountSummary {
  const groupedTrades = groupTradesByExecution(trades as Trade[])
  const groupedCountByAccountNumber = new Map<string, number>()
  const groupedCountByLiveAccountNumber = new Map<string, number>()
  const groupedCountByPhaseAccountId = new Map<string, number>()

  for (const trade of groupedTrades) {
    incrementCount(groupedCountByAccountNumber, trade.accountNumber)

    if (trade.phaseAccountId) {
      incrementCount(groupedCountByPhaseAccountId, trade.phaseAccountId)
    } else {
      incrementCount(groupedCountByLiveAccountNumber, trade.accountNumber)
    }
  }

  return {
    rawTradeRowCount: trades.length,
    groupedTradeCount: groupedTrades.length,
    partialExecutionGroupCount: groupedTrades.filter((trade) => trade.partialTrades.length > 1).length,
    groupedTrades,
    groupedCountByAccountNumber,
    groupedCountByLiveAccountNumber,
    groupedCountByPhaseAccountId,
  }
}
