import type { TradeType } from '@/lib/db/schema/trades';
import type { AccountType } from '@/lib/db/schema/accounts';

import { startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfWeek, endOfWeek, format, differenceInDays, getDay } from 'date-fns'
import { getTradingSession, getNewYorkHour } from '@/lib/time-utils'
import { calculateWinRate, classifyOutcome, DEFAULT_BREAK_EVEN_THRESHOLD } from '@/lib/metrics/outcome'
import { CHART_COLORS } from '@/app/dashboard/components/widget-card'
import { 
  calculateTradeRMultiple,
  hasValidTradeRMultipleData,
  calculatePeakToTroughDrawdown,
  calculateExpectancy 
} from '@/lib/math/performance-metrics'
import { calculateTotalStartingBalance } from '@/lib/utils/balance-calculator'
import { getTradeNetPnl } from '@/lib/metrics/pnl'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const isWinningTrade = (pnl: number, threshold: number) => classifyOutcome(pnl, threshold) === 'win'
const isLosingTrade = (pnl: number, threshold: number) => classifyOutcome(pnl, threshold) === 'loss'

// Generate an aggregated map of daily PnL and trade counts
function getDailyAggregations(
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

export function calculateDayOfWeekPerformance(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const dayMap: Record<number, { totalPnl: number; winPnl: number; lossPnl: number; wins: number; losses: number; total: number }> = {}

  for (let i = 0; i < 7; i++) {
    dayMap[i] = { totalPnl: 0, winPnl: 0, lossPnl: 0, wins: 0, losses: 0, total: 0 }
  }

  trades.forEach((trade) => {
    if (!trade.entryDate) return
    const dayOfWeek = getDay(new Date(trade.entryDate))
    const netPnl = getTradeNetPnl(trade)
    const dayData = dayMap[dayOfWeek]!
    
    dayData.totalPnl += netPnl
    dayData.total++
    if (isWinningTrade(netPnl, breakEvenThreshold)) {
      dayData.wins++
      dayData.winPnl += netPnl
    } else if (isLosingTrade(netPnl, breakEvenThreshold)) {
      dayData.losses++
      dayData.lossPnl += Math.abs(netPnl)
    }
  })

  return [1, 2, 3, 4, 5, 0, 6]
    .map((day) => {
      const d = dayMap[day]!
      return {
        day: DAY_NAMES[day],
        pnl: parseFloat(d.totalPnl.toFixed(2)),
        Win: parseFloat(d.winPnl.toFixed(2)),
        Loss: parseFloat(d.lossPnl.toFixed(2)),
        wins: d.wins,
        losses: d.losses,
        total: d.total,
      }
    })
    .filter((d) => d.total > 0)
}

export function calculateOutcomeDistribution(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const groupedTrades = groupTradesByExecution(trades as TradeType[])
  let wins = 0, losses = 0, breakeven = 0

  groupedTrades.forEach((trade) => {
    const netPnl = getTradeNetPnl(trade)
    if (isWinningTrade(netPnl, breakEvenThreshold)) wins++
    else if (isLosingTrade(netPnl, breakEvenThreshold)) losses++
    else breakeven++
  })

  return {
    data: [
      { name: 'Wins', value: wins, color: CHART_COLORS.bullish },
      { name: 'Losses', value: losses, color: CHART_COLORS.bearish },
      { name: 'Breakeven', value: breakeven, color: CHART_COLORS.muted },
    ].filter(d => d.value > 0),
    totalTrades: wins + losses + breakeven,
  }
}

export function calculateEquityCurve(trades: Partial<TradeType>[]) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.entryDate!).getTime() - new Date(b.entryDate!).getTime()
  )

  let cumulative = 0
  return sorted.map((trade) => {
    const netPnl = getTradeNetPnl(trade)
    cumulative += netPnl
    return {
      date: format(new Date(trade.entryDate!), 'MMM dd'),
      equity: parseFloat(cumulative.toFixed(2)),
    }
  })
}

export function calculatePerformanceSummaryMetrics(trades: Partial<TradeType>[]) {
  const equityCurve = calculateEquityCurve(trades)
  let maxDrawdown = 0
  let peak = 0
  let drawdownTotal = 0
  let drawdownCount = 0

  for (const point of equityCurve) {
    const equity = point.equity || 0
    if (equity > peak) peak = equity
    const drawdown = peak - equity
    if (drawdown > 0) {
      drawdownTotal += drawdown
      drawdownCount += 1
    }
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  const rCoverage = trades.reduce(
    (acc, trade) => {
      if (hasValidTradeRMultipleData(trade as any)) {
        acc.total += calculateTradeRMultiple(trade as any)
        acc.valid += 1
      }
      acc.all += 1
      return acc
    },
    { total: 0, valid: 0, all: 0 }
  )

  return {
    maxDrawdown,
    avgDrawdown: drawdownCount > 0 ? drawdownTotal / drawdownCount : 0,
    rCoverage,
  }
}

export function calculateNetDailyPnl(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const dailyMap = getDailyAggregations(trades, breakEvenThreshold)

  return Object.entries(dailyMap)
    .map(([date, values]) => ({
      date,
      pnl: parseFloat(values.pnl.toFixed(2)),
      shortNumber: values.shortNumber,
      longNumber: values.longNumber,
      wins: values.wins,
      losses: values.losses,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export function calculateDailyCumulativePnl(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const dailyMap = getDailyAggregations(trades, breakEvenThreshold)
  let cumulative = 0

  return Object.entries(dailyMap)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, values]) => {
      cumulative += values.pnl
      return {
        date,
        dailyPnL: parseFloat(values.pnl.toFixed(2)),
        cumulativePnL: parseFloat(cumulative.toFixed(2)),
        trades: values.shortNumber + values.longNumber,
      }
    })
}

export function calculateAccountBalanceChart(
  trades: Partial<TradeType>[],
  activeAccountsData?: any[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const dailyMap = getDailyAggregations(trades, breakEvenThreshold)
  
  // Use calculateTotalStartingBalance for proper prop-firm phase deduplication
  // This prevents double/triple counting when master account has multiple phases
  let startingBalance = 0
  if (activeAccountsData && activeAccountsData.length > 0) {
    startingBalance = calculateTotalStartingBalance(activeAccountsData)
  }

  let rollingBalance = startingBalance
  return Object.entries(dailyMap)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, values]) => {
      const prevBalance = rollingBalance
      rollingBalance += values.pnl
      return {
        date,
        balance: parseFloat(rollingBalance.toFixed(2)),
        change: parseFloat(values.pnl.toFixed(2)),
        changePercent: prevBalance !== 0 ? (values.pnl / prevBalance) * 100 : 0,
        trades: values.shortNumber + values.longNumber,
        wins: values.wins,
        losses: values.losses,
        hasActivity: true
      }
    })
}

import { groupTradesByExecution } from '@/lib/utils'
import { calculatePerformanceScore, calculateMetricsFromTrades } from '@/lib/performance-score'

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

export function calculatePerformanceScoreResult(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  if (!trades || trades.length === 0) {
    return { hasData: false, reason: 'no_data', message: 'Import trades to see your score.' }
  }

  if (trades.length < 10) {
    return { hasData: false, reason: 'not_enough_data', message: 'Not enough data. Minimum 10 trades required.' }
  }

  const metrics = calculateMetricsFromTrades(trades as any, breakEvenThreshold)
  if (!metrics) return { hasData: false }
  
  const scoreResult = calculatePerformanceScore(metrics)
  const radarData = [
    { metric: 'Win %', value: scoreResult.breakdown.tradeWinPercentageScore, fullMark: 100, rawValue: scoreResult.metrics.tradeWinPercentage, weight: 15, description: 'Percentage of winning trades', target: '60%+' },
    { metric: 'Profit Factor', value: scoreResult.breakdown.profitFactorScore, fullMark: 100, rawValue: scoreResult.metrics.profitFactor, weight: 25, description: 'Total Wins ÷ Total Losses', target: '2.6+' },
    { metric: 'Avg W/L', value: scoreResult.breakdown.avgWinLossScore, fullMark: 100, rawValue: scoreResult.metrics.avgWinLoss, weight: 20, description: 'Average Win ÷ Average Loss', target: '2.6+' },
    { metric: 'Recovery', value: scoreResult.breakdown.recoveryFactorScore, fullMark: 100, rawValue: scoreResult.metrics.recoveryFactor, weight: 10, description: 'Net Profit ÷ Max Drawdown', target: '3.5+' },
    { metric: 'Consistency', value: scoreResult.breakdown.consistencyScoreValue, fullMark: 100, rawValue: scoreResult.metrics.consistencyScore, weight: 10, description: 'Stability of daily returns', target: 'Higher is better' },
    { metric: 'Drawdown', value: scoreResult.breakdown.maxDrawdownScore, fullMark: 100, rawValue: scoreResult.metrics.maxDrawdown, weight: 20, description: 'Maximum peak-to-trough decline', target: 'Lower is better' },
  ]

  return { chartData: radarData, overallScore: scoreResult.overallScore, hasData: true }
}



export function calculateTradingOverviewKpis(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  if (!trades?.length) {
    return {
      currentStats: { monthTrades: 0, monthWinRate: 0, weekPnL: 0 },
      riskStats: { maxDrawdown: 0, largestLoss: 0, avgLoss: 0, lossStreak: 0 },
      streakData: { currentStreak: 0, isWinning: true, longestWinStreak: 0, longestLoseStreak: 0 }
    }
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  const monthTrades = trades.filter(t => {
    if (!t.entryDate) return false
    return isWithinInterval(new Date(t.entryDate), { start: monthStart, end: monthEnd })
  })

  const weekTrades = trades.filter(t => {
    if (!t.entryDate) return false
    return isWithinInterval(new Date(t.entryDate), { start: weekStart, end: weekEnd })
  })

  const monthWins = monthTrades.filter(t => isWinningTrade(getTradeNetPnl(t), breakEvenThreshold)).length
  const monthLosses = monthTrades.filter(t => isLosingTrade(getTradeNetPnl(t), breakEvenThreshold)).length
  const weekPnL = weekTrades.reduce((sum, t) => sum + getTradeNetPnl(t), 0)

  const currentStats = { 
    monthTrades: monthTrades.length, 
    monthWinRate: calculateWinRate(monthWins, monthLosses),
    weekPnL 
  }

  const sortedByTime = [...trades].sort((a, b) => (new Date(a.entryDate || 0).getTime()) - (new Date(b.entryDate || 0).getTime()))
  const pnls = sortedByTime.map(t => getTradeNetPnl(t))
  
  const { maxDrawdown } = calculatePeakToTroughDrawdown(pnls)

  const losses = trades.filter(t => isLosingTrade(getTradeNetPnl(t), breakEvenThreshold))
  const largestLoss = Math.abs(Math.min(...losses.map(t => getTradeNetPnl(t)), 0))
  const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + Math.abs(getTradeNetPnl(t)), 0) / losses.length : 0

  let lossStreak = 0
  for (let i = sortedByTime.length - 1; i >= 0; i--) {
    const netPnl = getTradeNetPnl(sortedByTime[i])
    if (isLosingTrade(netPnl, breakEvenThreshold)) lossStreak++
    else if (isWinningTrade(netPnl, breakEvenThreshold)) break
  }

  const riskStats = { maxDrawdown, largestLoss, avgLoss, lossStreak }

  const sortedDesc = [...sortedByTime].reverse()
  let currentStreak = 0
  const firstNetPnl = getTradeNetPnl(sortedDesc[0])
  const isWinning = isWinningTrade(firstNetPnl, breakEvenThreshold)
  const wasWin = isWinning

  for (const trade of sortedDesc) {
    const netPnl = getTradeNetPnl(trade)
    if (isWinningTrade(netPnl, breakEvenThreshold) === wasWin) currentStreak++
    else break
  }

  let longestWinStreak = 0, longestLoseStreak = 0, tempStreak = 0
  let lastWasWin: boolean | null = null

  for (const trade of sortedByTime) {
    const isWin = isWinningTrade(getTradeNetPnl(trade), breakEvenThreshold)
    if (lastWasWin === null) { tempStreak = 1; lastWasWin = isWin }
    else if (isWin === lastWasWin) { tempStreak++ }
    else {
      if (lastWasWin) longestWinStreak = Math.max(longestWinStreak, tempStreak)
      else longestLoseStreak = Math.max(longestLoseStreak, tempStreak)
      tempStreak = 1; lastWasWin = isWin
    }
  }
  if (lastWasWin) longestWinStreak = Math.max(longestWinStreak, tempStreak)
  else if (lastWasWin === false) longestLoseStreak = Math.max(longestLoseStreak, tempStreak)

  const streakData = { currentStreak, isWinning, longestWinStreak, longestLoseStreak }

  return { currentStats, riskStats, streakData }
}

export function calculateCalendarData(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const data: Record<string, { 
    pnl: number; 
    tradeNumber: number; 
    longNumber: number; 
    shortNumber: number;
    dailyRMultiple: number;
    isProfit: boolean;
    isLoss: boolean;
    isBreakEven: boolean;
  }> = {}

  trades.forEach(trade => {
    if (!trade.entryDate) return

    const key = format(new Date(trade.entryDate), 'yyyy-MM-dd')
    if (!data[key]) {
      data[key] = { 
        pnl: 0, 
        tradeNumber: 0, 
        longNumber: 0, 
        shortNumber: 0,
        dailyRMultiple: 0,
        isProfit: false,
        isLoss: false,
        isBreakEven: true
      }
    }

    const netPnl = getTradeNetPnl(trade)
    data[key].pnl += netPnl
    data[key].tradeNumber++

    const r = calculateTradeRMultiple(trade as any)
    data[key].dailyRMultiple += r

    const side = trade.side?.toLowerCase()
    const isLong = side === 'long' || side === 'buy' || side === 'b'
    if (isLong) data[key].longNumber++
    else data[key].shortNumber++
    
    data[key].isProfit = isWinningTrade(data[key].pnl, breakEvenThreshold)
    data[key].isLoss = isLosingTrade(data[key].pnl, breakEvenThreshold)
    data[key].isBreakEven = !data[key].isProfit && !data[key].isLoss
  })

  return data
}

export function calculateSessionAnalysis(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const stats: Record<string, { trades: number; wins: number; pnl: number }> = {
      'New York': { trades: 0, wins: 0, pnl: 0 },
      'London': { trades: 0, wins: 0, pnl: 0 },
      'Asia': { trades: 0, wins: 0, pnl: 0 },
  }

  trades.forEach(trade => {
      if (!trade.entryDate) return

      try {
          const session = getTradingSession(trade.entryDate)

          if (session && stats[session]) {
              const netPnl = getTradeNetPnl(trade)
              stats[session].trades++
              stats[session].pnl += netPnl
              if (isWinningTrade(netPnl, breakEvenThreshold)) {
                  stats[session].wins++
              }
          }
      } catch {
      }
  })

  return stats
}

export function calculateAccountProgression(
  trades: Partial<TradeType>[],
  accounts: any[] = [],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const cumulative = calculateDailyCumulativePnl(trades, breakEvenThreshold)
  const balance = calculateAccountBalanceChart(trades, accounts, breakEvenThreshold)
  const equityValues = cumulative.map((point) => Number(point.cumulativePnL || 0))
  const peak = equityValues.reduce((max, value) => Math.max(max, value), 0)
  let runningPeak = 0
  let maxDrawdown = 0
  let currentDrawdown = 0

  for (const value of equityValues) {
    runningPeak = Math.max(runningPeak, value)
    const drawdown = runningPeak - value
    maxDrawdown = Math.max(maxDrawdown, drawdown)
    currentDrawdown = drawdown
  }

  return {
    cumulative,
    balance,
    summary: {
      net: equityValues[equityValues.length - 1] || 0,
      peak,
      maxDrawdown,
      currentDrawdown,
      days: cumulative.length,
    },
  }
}

export function calculateTagPerformance(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  const tagMap: Record<string, { pnl: number; trades: number; wins: number; losses: number; grossWin: number; grossLoss: number }> = {}

  groupedTrades.forEach((trade: any) => {
    const tags = Array.isArray(trade.tags) && trade.tags.length > 0 ? trade.tags : ['Untagged']
    const netPnl = getTradeNetPnl(trade)
    tags.forEach((tag: string) => {
      if (!tagMap[tag]) tagMap[tag] = { pnl: 0, trades: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0 }
      tagMap[tag].pnl += netPnl
      tagMap[tag].trades++
      if (isWinningTrade(netPnl, breakEvenThreshold)) {
        tagMap[tag].wins++
        tagMap[tag].grossWin += netPnl
      } else if (isLosingTrade(netPnl, breakEvenThreshold)) {
        tagMap[tag].losses++
        tagMap[tag].grossLoss += Math.abs(netPnl)
      }
    })
  })

  return Object.entries(tagMap).map(([tag, stats]) => ({
    tag,
    ...stats,
    winRate: calculateWinRate(stats.wins, stats.losses),
    expectancy: stats.trades > 0 ? stats.pnl / stats.trades : 0,
    profitFactor: stats.grossLoss > 0 ? stats.grossWin / stats.grossLoss : stats.grossWin > 0 ? 999 : 0,
  })).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)).slice(0, 12)
}

export function calculateTimeOfDayPerformance(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  const hours: Record<number, { hour: number; pnl: number; trades: number; wins: number; losses: number }> = {}
  for (let hour = 0; hour < 24; hour++) hours[hour] = { hour, pnl: 0, trades: 0, wins: 0, losses: 0 }

  groupedTrades.forEach((trade: any) => {
    if (!trade.entryDate) return
    const hour = getNewYorkHour(trade.entryDate)
    if (hour == null) return
    const netPnl = getTradeNetPnl(trade)
    if (hours[hour]) {
      hours[hour].pnl += netPnl
      hours[hour].trades++
      if (isWinningTrade(netPnl, breakEvenThreshold)) hours[hour].wins++
      else if (isLosingTrade(netPnl, breakEvenThreshold)) hours[hour].losses++
    }
  })

  return Object.values(hours).map((item) => ({
    ...item,
    winRate: calculateWinRate(item.wins, item.losses),
    avgPnl: item.trades > 0 ? item.pnl / item.trades : 0,
  }))
}

export function calculateDisciplineAnalytics(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  let broken = 0
  let withRules = 0
  let selectedRuleCount = 0
  const modelMap: Record<string, { model: string; trades: number; pnl: number; broken: number }> = {}

  groupedTrades.forEach((trade: any) => {
    const netPnl = getTradeNetPnl(trade)
    const rules = Array.isArray(trade.selectedRules) ? trade.selectedRules : []
    if (rules.length > 0) {
      withRules++
      selectedRuleCount += rules.length
    }
    if (trade.ruleBroken) broken++
    const model = trade.tradingModel || trade.TradingModel?.name || 'No Playbook'
    if (!modelMap[model]) modelMap[model] = { model, trades: 0, pnl: 0, broken: 0 }
    modelMap[model].trades++
    modelMap[model].pnl += netPnl
    if (trade.ruleBroken) modelMap[model].broken++
  })

  return {
    totalTrades: groupedTrades.length,
    brokenRules: broken,
    ruleBrokenRate: groupedTrades.length > 0 ? (broken / groupedTrades.length) * 100 : 0,
    ruleCoverage: groupedTrades.length > 0 ? (withRules / groupedTrades.length) * 100 : 0,
    avgRulesPerTaggedTrade: withRules > 0 ? selectedRuleCount / withRules : 0,
    playbooks: Object.values(modelMap).sort((a, b) => b.trades - a.trades).slice(0, 8),
  }
}
