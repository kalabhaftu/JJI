import { formatInTimeZone } from 'date-fns-tz'

import type { Account } from '@/context/data-provider'
import type { TradeType as Trade } from '@/lib/db/schema/trades'
import { calculateTradeRMultiple } from '@/lib/math/performance-metrics'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { getTradeEntryTimestamp } from '@/lib/trade-core'
import {
  groupTradesByExecution,
  type GroupedTrade,
} from '@/lib/trading/trade-grouping'

export function formatCalendarData(
  trades: Trade[],
  _accounts: Account[] = [],
  timezone = 'UTC',
  preGrouped?: GroupedTrade[],
) {
  const groupedTrades = preGrouped ?? groupTradesByExecution(trades)
  return groupedTrades.reduce((calendar: Record<string, {
    pnl: number
    tradeNumber: number
    longNumber: number
    shortNumber: number
    dailyRMultiple: number
    trades: Trade[]
  }>, trade) => {
    const entryTimestamp = getTradeEntryTimestamp(trade)
      ?? new Date(trade.entryDate)
    const date = formatInTimeZone(entryTimestamp, timezone, 'yyyy-MM-dd')
    const day = calendar[date] ?? {
      pnl: 0,
      tradeNumber: 0,
      longNumber: 0,
      shortNumber: 0,
      dailyRMultiple: 0,
      trades: [],
    }
    day.tradeNumber += 1
    day.pnl += getTradeNetPnl(trade)
    day.dailyRMultiple += calculateTradeRMultiple(trade)
    const isLong = trade.side
      ? ['long', 'buy', 'b'].includes(trade.side.toLowerCase())
      : new Date(trade.entryDate).getTime() < new Date(trade.closeDate).getTime()
    day.longNumber += isLong ? 1 : 0
    day.shortNumber += isLong ? 0 : 1
    day.trades.push(trade)
    calendar[date] = day
    return calendar
  }, {})
}
