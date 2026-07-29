import type { TradeType as Trade } from '@/lib/db/schema/trades'
import {
  buildTradeIdentityKey,
  getTradeEntryTimestamp,
} from '@/lib/trade-core'

export interface GroupedTrade extends Trade {
  partialTrades: Trade[]
  isGrouped: boolean
  pnl: number
  commission: number
  quantity: number
  timeInPosition: number
  exitTime: Date | null
  entryTime: Date | null
  closeDate: string
  entryDate: string
  closePrice: string
  entryPrice: string
  accountNumber: string
  symbol: string | null
  instrument: string
  side: string | null
}

export function groupTradesByExecution(trades: Trade[]): GroupedTrade[] {
  const groups = new Map<string, GroupedTrade>()

  for (const trade of trades) {
    let key: string
    if (trade.entryId?.trim()) {
      key = `entryId:${trade.entryId}`
    } else {
      const entryDate = getTradeEntryTimestamp(trade) ?? new Date(trade.entryDate)
      const roundedTime = new Date(entryDate)
      roundedTime.setSeconds(0, 0)
      key = `fallback:${trade.instrument}:${roundedTime.toISOString()}:${trade.side}`
    }

    const group = groups.get(key)
    if (!group) {
      groups.set(key, {
        ...trade,
        partialTrades: [trade],
        isGrouped: false,
        pnl: trade.pnl || 0,
        commission: trade.commission || 0,
        quantity: trade.quantity || 0,
        timeInPosition: trade.timeInPosition || 0,
        exitTime: trade.exitTime || null,
        entryTime: trade.entryTime || null,
        closeDate: trade.closeDate || '',
        entryDate: trade.entryDate || '',
        closePrice: trade.closePrice || '0',
        entryPrice: trade.entryPrice || '0',
        accountNumber: trade.accountNumber || '',
        symbol: trade.symbol || null,
        instrument: trade.instrument || '',
        side: trade.side || null,
      } as GroupedTrade)
      continue
    }

    group.partialTrades.push(trade)
    group.isGrouped = true
    group.pnl += trade.pnl || 0
    group.commission += trade.commission || 0
    group.quantity += trade.quantity || 0
    if ((trade.timeInPosition || 0) > group.timeInPosition) {
      group.timeInPosition = trade.timeInPosition || 0
      group.closeDate = trade.closeDate
      group.closePrice = trade.closePrice
      if (trade.exitTime) group.exitTime = trade.exitTime
    }
  }

  return [...groups.values()]
}

export function generateTradeHash(trade: Partial<Trade>): string {
  return buildTradeIdentityKey(trade)
}
