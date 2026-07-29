import type { TradeType } from '@/lib/db/schema/trades';
import { startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek, format, getDay } from 'date-fns'
import { calculateWinRate, classifyOutcome, DEFAULT_BREAK_EVEN_THRESHOLD } from '@/lib/metrics/outcome'
import { CHART_COLORS } from '@/app/dashboard/components/widget-card'
import { 
  calculateTradeRMultiple,
  hasValidTradeRMultipleData,
  calculatePeakToTroughDrawdown,
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

import { groupTradesByExecution } from '@/lib/trading/trade-grouping'
import { calculatePerformanceScore, calculateMetricsFromTrades } from '@/lib/performance-score'

export {
  calculatePnlByInstrument,
  calculatePnlByStrategy,
  calculateTradeDurationPerformance,
  calculateWeekdayPnl,
  calculateWinRateByStrategy,
} from '@/lib/dashboard/analytics/strategy'

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


export {
  calculateDisciplineAnalytics,
  calculateSessionAnalysis,
  calculateTagPerformance,
  calculateTimeOfDayPerformance,
} from '@/lib/dashboard/analytics/behavior'
