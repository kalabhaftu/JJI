import type { TradeType } from '@/lib/db/schema/trades'
import {
  calculateWinRate,
  classifyOutcome,
  DEFAULT_BREAK_EVEN_THRESHOLD,
} from '@/lib/metrics/outcome'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { groupTradesByExecution } from '@/lib/trading/trade-grouping'

const isWinningTrade = (pnl: number, threshold: number) =>
  classifyOutcome(pnl, threshold) === 'win'
const isLosingTrade = (pnl: number, threshold: number) =>
  classifyOutcome(pnl, threshold) === 'loss'

export function calculatePnlByStrategy(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  const strategyMap: Record<string, { pnl: number; trades: number; wins: number; losses: number; grossWin: number; grossLoss: number }> = {}

  groupedTrades.forEach((trade: any) => {
    const strategy = trade.tradingModel || trade.TradingModel?.name || 'No Strategy'
    if (!strategyMap[strategy]) strategyMap[strategy] = { pnl: 0, trades: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0 }
    const netPnl = getTradeNetPnl(trade)
    strategyMap[strategy].pnl += netPnl
    strategyMap[strategy].trades += 1

    if (isWinningTrade(netPnl, breakEvenThreshold)) {
      strategyMap[strategy].wins += 1
      strategyMap[strategy].grossWin += netPnl
    } else if (isLosingTrade(netPnl, breakEvenThreshold)) {
      strategyMap[strategy].losses += 1
      strategyMap[strategy].grossLoss += Math.abs(netPnl)
    }
  })

  return Object.entries(strategyMap).map(([strategy, stats]) => {
    const tradableCount = stats.wins + stats.losses
    return {
      strategy,
      pnl: stats.pnl,
      trades: stats.trades,
      wins: stats.wins,
      losses: stats.losses,
      winRate: calculateWinRate(stats.wins, stats.losses),
      avgPnl: stats.trades > 0 ? stats.pnl / stats.trades : 0,
      profitFactor: stats.grossLoss > 0 ? stats.grossWin / stats.grossLoss : stats.grossWin > 0 ? 999 : 0,
    }
  }).sort((a, b) => b.pnl - a.pnl)
}

export function calculatePnlByInstrument(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  const instrumentMap: Record<string, { pnl: number; trades: number; wins: number; losses: number }> = {}

  groupedTrades.forEach((trade: any) => {
    const instrument = trade.instrument || trade.symbol || 'Unknown'
    if (!instrumentMap[instrument]) instrumentMap[instrument] = { pnl: 0, trades: 0, wins: 0, losses: 0 }
    const netPnl = getTradeNetPnl(trade)
    instrumentMap[instrument].pnl += netPnl
    instrumentMap[instrument].trades += 1
    if (isWinningTrade(netPnl, breakEvenThreshold)) instrumentMap[instrument].wins += 1
    else if (isLosingTrade(netPnl, breakEvenThreshold)) instrumentMap[instrument].losses += 1
  })

  return Object.entries(instrumentMap).map(([instrument, stats]) => ({
    instrument,
    pnl: stats.pnl,
    trades: stats.trades,
    wins: stats.wins,
    losses: stats.losses,
    winRate: calculateWinRate(stats.wins, stats.losses),
  })).sort((a, b) => b.pnl - a.pnl)
}

export function calculateWinRateByStrategy(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  const strategyMap: Record<string, { wins: number; losses: number; grossWin: number; grossLoss: number; allWins: number[] }> = {}

  groupedTrades.forEach((trade: any) => {
    const strategy = trade.tradingModel || trade.TradingModel?.name || 'No Strategy'
    if (!strategyMap[strategy]) strategyMap[strategy] = { wins: 0, losses: 0, grossWin: 0, grossLoss: 0, allWins: [] }
    const netPnl = getTradeNetPnl(trade)
    if (isWinningTrade(netPnl, breakEvenThreshold)) {
      strategyMap[strategy].wins += 1
      strategyMap[strategy].grossWin += netPnl
      strategyMap[strategy].allWins.push(netPnl)
    } else if (isLosingTrade(netPnl, breakEvenThreshold)) {
      strategyMap[strategy].losses += 1
      strategyMap[strategy].grossLoss += Math.abs(netPnl)
    }
  })

  return Object.entries(strategyMap).map(([strategy, stats]) => {
    const totalTrades = stats.wins + stats.losses
    const avgWin = stats.allWins.length > 0 ? stats.allWins.reduce((a, b) => a + b, 0) / stats.allWins.length : 0
    const variance = stats.allWins.length > 0
      ? stats.allWins.reduce((sum, win) => sum + Math.pow(win - avgWin, 2), 0) / stats.allWins.length : 0
    const stdDev = Math.sqrt(variance)
    return {
      strategy,
      winRate: calculateWinRate(stats.wins, stats.losses),
      totalTrades,
      wins: stats.wins,
      losses: stats.losses,
      profitFactor: stats.grossLoss > 0 ? stats.grossWin / stats.grossLoss : stats.grossWin > 0 ? 999 : 0,
      consistency: avgWin > 0 ? Math.max(0, 100 - (stdDev / avgWin) * 100) : 0,
    }
  }).sort((a, b) => b.winRate - a.winRate)
}

function calculateDurationMinutes(entryTime: string, exitTime: string): number {
  return (new Date(exitTime).getTime() - new Date(entryTime).getTime()) / (1000 * 60)
}

function getDurationBucket(minutes: number): string {
  if (minutes < 1) return "< 1min"
  if (minutes < 5) return "1-5min"
  if (minutes < 15) return "5-15min"
  if (minutes < 30) return "15-30min"
  if (minutes < 60) return "30min-1hr"
  if (minutes < 120) return "1-2hr"
  if (minutes < 240) return "2-4hr"
  return "4hr+"
}

export function calculateTradeDurationPerformance(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  const durationMap: Record<string, { pnl: number; trades: number; wins: number; losses: number }> = {}
  
  const order = ["< 1min", "1-5min", "5-15min", "15-30min", "30min-1hr", "1-2hr", "2-4hr", "4hr+"]
  order.forEach(b => { durationMap[b] = { pnl: 0, trades: 0, wins: 0, losses: 0 } })

  groupedTrades.forEach((trade: any) => {
    if (trade.entryDate && trade.closeDate) {
      const durationMinutes = calculateDurationMinutes(trade.entryDate.toString(), trade.closeDate.toString())
      const bucket = getDurationBucket(durationMinutes)
      const netPnL = getTradeNetPnl(trade)
      const bData = durationMap[bucket]!
      bData.pnl += netPnL
      bData.trades++

      if (isWinningTrade(netPnL, breakEvenThreshold)) bData.wins++
      else if (isLosingTrade(netPnL, breakEvenThreshold)) bData.losses++
    }
  })

  return order.map(bucket => {
    const data = durationMap[bucket] || { pnl: 0, trades: 0, wins: 0, losses: 0 }
    return {
      bucket,
      pnl: data.pnl,
      trades: data.trades,
      wins: data.wins,
      losses: data.losses,
      winRate: calculateWinRate(data.wins, data.losses),
      avgPnl: data.trades > 0 ? data.pnl / data.trades : 0,
    }
  }).filter(item => item.trades > 0)
}

export function calculateWeekdayPnl(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  const weekdayMap: Record<number, { pnl: number; trades: number; wins: number; losses: number }> = {}

  groupedTrades.forEach((trade: any) => {
    if (!trade.entryDate) return
    const dayOfWeek = new Date(trade.entryDate).getDay()

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (!weekdayMap[dayOfWeek]) weekdayMap[dayOfWeek] = { pnl: 0, trades: 0, wins: 0, losses: 0 }
      const netPnL = getTradeNetPnl(trade)
      weekdayMap[dayOfWeek].pnl += netPnL
      weekdayMap[dayOfWeek].trades++
      if (isWinningTrade(netPnL, breakEvenThreshold)) weekdayMap[dayOfWeek].wins++
      else if (isLosingTrade(netPnL, breakEvenThreshold)) weekdayMap[dayOfWeek].losses++
    }
  })

  const weekdays = [
    { day: '1', dayName: 'Monday' },
    { day: '2', dayName: 'Tuesday' },
    { day: '3', dayName: 'Wednesday' },
    { day: '4', dayName: 'Thursday' },
    { day: '5', dayName: 'Friday' },
  ]

  return weekdays.map(({ day, dayName }) => {
    const dayNum = parseInt(day)
    const data = weekdayMap[dayNum] || { pnl: 0, trades: 0, wins: 0, losses: 0 }
    return {
      day,
      dayName,
      pnl: data.pnl,
      trades: data.trades,
      wins: data.wins,
      losses: data.losses,
      winRate: calculateWinRate(data.wins, data.losses),
    }
  })
}
