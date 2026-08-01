import type { TradeType } from '@/lib/db/schema/trades'
import { classifyOutcome, DEFAULT_BREAK_EVEN_THRESHOLD } from '@/lib/metrics/outcome'
import { getTradeNetPnl } from '@/lib/metrics/pnl'

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const isWinningTrade = (pnl: number, threshold: number) => classifyOutcome(pnl, threshold) === 'win'
export const isLosingTrade = (pnl: number, threshold: number) => classifyOutcome(pnl, threshold) === 'loss'

// Generate an aggregated map of daily PnL and trade counts
export function getDailyAggregations(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const dailyMap: Record<string, { pnl: number; wins: number; losses: number; shortNumber: number; longNumber: number }> = {}

  trades.forEach(trade => {
    if (!trade.entryDate) return
    const dateStr = trade.entryDate.toString().split('T')[0]
    if (!dateStr) return
    
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { pnl: 0, wins: 0, losses: 0, shortNumber: 0, longNumber: 0 }
    }

    const netPnl = getTradeNetPnl(trade)
    dailyMap[dateStr].pnl += netPnl

    if (isWinningTrade(netPnl, breakEvenThreshold)) dailyMap[dateStr].wins++
    else if (isLosingTrade(netPnl, breakEvenThreshold)) dailyMap[dateStr].losses++

    if (trade.side === 'SHORT') dailyMap[dateStr].shortNumber++
    if (trade.side === 'LONG') dailyMap[dateStr].longNumber++
  })

  return dailyMap
}
