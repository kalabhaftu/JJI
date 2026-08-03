import { format } from 'date-fns'
import type { TradeType } from '@/lib/db/schema/trades'
import { calculateTradeRMultiple, hasValidTradeRMultipleData } from '@/lib/math/performance-metrics'
import { DEFAULT_BREAK_EVEN_THRESHOLD } from '@/lib/metrics/outcome'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { calculateTotalStartingBalance } from '@/lib/utils/balance-calculator'
import { getDailyAggregations } from '@/lib/dashboard/analytics/common'

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

