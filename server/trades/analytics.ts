import * as Sentry from '@sentry/nextjs'
import { calculateStatistics, classifyTrade, formatCalendarData, groupTradesByExecution } from '@/lib/utils'
import {
  calculateDayOfWeekPerformance,
  calculateOutcomeDistribution,
  calculateEquityCurve,
  calculateNetDailyPnl,
  calculateDailyCumulativePnl,
  calculateAccountBalanceChart,
  calculatePnlByStrategy,
  calculatePnlByInstrument,
  calculateWinRateByStrategy,
  calculateTradeDurationPerformance,
  calculateWeekdayPnl,
  calculatePerformanceScoreResult,
  calculateSessionAnalysis,
  calculateAccountProgression,
  calculateTagPerformance,
  calculateTimeOfDayPerformance,
  calculateDisciplineAnalytics,
  calculatePerformanceSummaryMetrics,
} from '@/lib/dashboard/analytics-calculations'
import { calculateBalanceInfo } from '@/lib/utils/balance-calculator'
import { convertDecimal } from '@/lib/utils/decimal'
import { getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { getTradeNetPnl, normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import { getHourInTimezone, getWeekdayIndexInTimezone } from '@/lib/time-utils'
import type { TradeQueryFilters } from './filters'

export function serializeTrades(rawTrades: any[]) {
  return rawTrades.map((trade) => ({
    ...trade,
    entryPrice: convertDecimal(trade.entryPrice),
    closePrice: convertDecimal(trade.closePrice),
    stopLoss: convertDecimal(trade.stopLoss),
    takeProfit: convertDecimal(trade.takeProfit),
    tradingModel: trade.TradingModel?.name || null,
  }))
}

export function applyPostQueryFilters(trades: any[], filters: TradeQueryFilters, breakEvenThreshold: number) {
  return trades.filter((trade) => {
    if (filters.weekday !== null && (!trade.entryDate || getWeekdayIndexInTimezone(trade.entryDate, filters.timezone) !== filters.weekday)) {
      return false
    }
    if (filters.hour !== null && (!trade.entryDate || getHourInTimezone(trade.entryDate, filters.timezone) !== filters.hour)) {
      return false
    }
    if (filters.outcome === 'win' || filters.outcome === 'loss' || filters.outcome === 'breakeven') {
      return classifyTrade(getTradeNetPnl(trade), breakEvenThreshold) === filters.outcome
    }
    return true
  })
}

export function buildAccounts(regularAccounts: any[], propFirmAccounts: any[]) {
  return [
    ...regularAccounts,
    ...propFirmAccounts.flatMap((master: any) => (master.PhaseAccount || []).map((phase: any) => ({
      id: phase.id,
      number: phase.phaseId,
      startingBalance: master.accountSize,
      accountType: 'prop-firm' as const,
      status: phase.status,
      currentPhaseDetails: {
        phaseNumber: phase.phaseNumber,
        status: phase.status,
        masterAccountId: master.id,
        masterAccountName: master.accountName,
      },
    }))),
  ]
}

type AnalyticsInput = {
  trades: any[]
  accounts: any[]
  accountNumbers: string[]
  includeStats: boolean
  includeCalendar: boolean
  includeWidgets: boolean
  groupByExecution: boolean
  timezone: string
  breakEvenThreshold: number
  pnlDisplayMode: ReturnType<typeof normalizePnlDisplayMode>
  relevantTransactions: any[]
}

function safeWidget<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch (error) {
    Sentry.captureException(error, { extra: { route: '/api/v1/trades', widget: 'safeWidget' } })
    return fallback
  }
}

export function buildTradeAnalytics(input: AnalyticsInput) {
  const {
    trades,
    accounts,
    accountNumbers,
    includeStats,
    includeCalendar,
    includeWidgets,
    groupByExecution,
    timezone,
    breakEvenThreshold,
    pnlDisplayMode,
    relevantTransactions,
  } = input
  const grouped = (includeStats || includeCalendar || groupByExecution) ? groupTradesByExecution(trades) : undefined
  const statistics = includeStats ? calculateStatistics(trades, accounts, grouped, breakEvenThreshold) : null
  const calendarData = includeCalendar ? formatCalendarData(trades, accounts, timezone, grouped) : null
  const responseTrades = groupByExecution ? (grouped ?? groupTradesByExecution(trades)) : trades
  const filteredAccounts = accountNumbers.length > 0
    ? accounts.filter((account: any) => accountNumbers.includes(account.number) || accountNumbers.includes(account.id))
    : accounts
  const widgetCalendarData = includeWidgets
    ? (calendarData || formatCalendarData(trades, accounts, timezone, grouped))
    : null

  const zeroBalanceResult = {
    startingBalance: 0, currentBalance: 0, currentGrossBalance: 0,
    totalPnL: 0, grossPnL: 0, totalFees: 0, totalCommissions: 0,
    netPnL: 0, displayPnL: 0, displayBalance: 0, pnlDisplayMode: 'net' as const,
    changeAmount: 0, changePercent: 0,
  }

  const widgets = includeWidgets ? {
    equityCurve: safeWidget(() => calculateEquityCurve(trades), []),
    netDailyPnl: safeWidget(() => calculateNetDailyPnl(trades, breakEvenThreshold), []),
    dailyCumulativePnl: safeWidget(() => calculateDailyCumulativePnl(trades, breakEvenThreshold), []),
    outcomeDistribution: safeWidget(() => calculateOutcomeDistribution(trades, breakEvenThreshold), { data: [], totalTrades: 0 } as any),
    dayOfWeekPerformance: safeWidget(() => calculateDayOfWeekPerformance(trades, breakEvenThreshold), []),
    accountBalanceChart: safeWidget(() => calculateAccountBalanceChart(trades, filteredAccounts, breakEvenThreshold), []),
    pnlByStrategy: safeWidget(() => calculatePnlByStrategy(trades, breakEvenThreshold), []),
    pnlByInstrument: safeWidget(() => calculatePnlByInstrument(trades, breakEvenThreshold), []),
    winRateByStrategy: safeWidget(() => calculateWinRateByStrategy(trades, breakEvenThreshold), []),
    tradeDurationPerformance: safeWidget(() => calculateTradeDurationPerformance(trades, breakEvenThreshold), []),
    weekdayPnl: safeWidget(() => calculateWeekdayPnl(trades, breakEvenThreshold), []),
    performanceScore: safeWidget(() => calculatePerformanceScoreResult(trades, breakEvenThreshold), { hasData: false } as any),
    performanceSummary: safeWidget(() => calculatePerformanceSummaryMetrics(trades), { maxDrawdown: 0, avgDrawdown: 0, rCoverage: { total: 0, valid: 0, all: 0 } }),
    sessionAnalysis: safeWidget(() => calculateSessionAnalysis(trades, breakEvenThreshold), {} as any),
    accountProgression: safeWidget(() => calculateAccountProgression(trades, filteredAccounts, breakEvenThreshold), { cumulative: [], balance: [], summary: {} } as any),
    tagPerformance: safeWidget(() => calculateTagPerformance(trades, breakEvenThreshold), {} as any),
    timeOfDayPerformance: safeWidget(() => calculateTimeOfDayPerformance(trades, breakEvenThreshold), []),
    disciplineAnalytics: safeWidget(() => calculateDisciplineAnalytics(trades, breakEvenThreshold), { totalTrades: 0, brokenRules: 0, ruleBrokenRate: 0, ruleCoverage: 0, avgRulesPerTaggedTrade: 0, playbooks: [] } as any),
    calendarData: widgetCalendarData,
    accountBalancePnl: safeWidget(() => calculateBalanceInfo(filteredAccounts, trades, relevantTransactions, { pnlDisplayMode }), zeroBalanceResult),
  } : null

  return { responseTrades, statistics, calendarData, widgets }
}
