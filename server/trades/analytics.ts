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

  // Filter out missed trades from analytics, but keep them for the trades list
  const analyticsTrades = trades.filter((t: any) => !t.isMissedTrade)

  const grouped = (includeStats || includeCalendar || groupByExecution) ? groupTradesByExecution(analyticsTrades) : undefined
  const statistics = includeStats ? calculateStatistics(analyticsTrades, accounts, grouped, breakEvenThreshold) : null
  const calendarData = includeCalendar ? formatCalendarData(analyticsTrades, accounts, timezone, grouped) : null
  const responseTrades = groupByExecution ? (groupTradesByExecution(trades)) : trades
  const filteredAccounts = accountNumbers.length > 0
    ? accounts.filter((account: any) => accountNumbers.includes(account.number) || accountNumbers.includes(account.id))
    : accounts
  const widgetCalendarData = includeWidgets
    ? (calendarData || formatCalendarData(analyticsTrades, accounts, timezone, grouped))
    : null

  const zeroBalanceResult = {
    startingBalance: 0, currentBalance: 0, currentGrossBalance: 0,
    totalPnL: 0, grossPnL: 0, totalFees: 0, totalCommissions: 0,
    netPnL: 0, displayPnL: 0, displayBalance: 0, pnlDisplayMode: 'net' as const,
    changeAmount: 0, changePercent: 0,
  }

  const widgets = includeWidgets ? {
    equityCurve: safeWidget(() => calculateEquityCurve(analyticsTrades), []),
    netDailyPnl: safeWidget(() => calculateNetDailyPnl(analyticsTrades, breakEvenThreshold), []),
    dailyCumulativePnl: safeWidget(() => calculateDailyCumulativePnl(analyticsTrades, breakEvenThreshold), []),
    outcomeDistribution: safeWidget(() => calculateOutcomeDistribution(analyticsTrades, breakEvenThreshold), { data: [], totalTrades: 0 } as any),
    dayOfWeekPerformance: safeWidget(() => calculateDayOfWeekPerformance(analyticsTrades, breakEvenThreshold), []),
    accountBalanceChart: safeWidget(() => calculateAccountBalanceChart(analyticsTrades, filteredAccounts, breakEvenThreshold), []),
    pnlByStrategy: safeWidget(() => calculatePnlByStrategy(analyticsTrades, breakEvenThreshold), []),
    pnlByInstrument: safeWidget(() => calculatePnlByInstrument(analyticsTrades, breakEvenThreshold), []),
    winRateByStrategy: safeWidget(() => calculateWinRateByStrategy(analyticsTrades, breakEvenThreshold), []),
    tradeDurationPerformance: safeWidget(() => calculateTradeDurationPerformance(analyticsTrades, breakEvenThreshold), []),
    weekdayPnl: safeWidget(() => calculateWeekdayPnl(analyticsTrades, breakEvenThreshold), []),
    performanceScore: safeWidget(() => calculatePerformanceScoreResult(analyticsTrades, breakEvenThreshold), { hasData: false } as any),
    performanceSummary: safeWidget(() => calculatePerformanceSummaryMetrics(analyticsTrades), { maxDrawdown: 0, avgDrawdown: 0, rCoverage: { total: 0, valid: 0, all: 0 } }),
    sessionAnalysis: safeWidget(() => calculateSessionAnalysis(analyticsTrades, breakEvenThreshold), {} as any),
    accountProgression: safeWidget(() => calculateAccountProgression(analyticsTrades, filteredAccounts, breakEvenThreshold), { cumulative: [], balance: [], summary: {} } as any),
    tagPerformance: safeWidget(() => calculateTagPerformance(analyticsTrades, breakEvenThreshold), {} as any),
    timeOfDayPerformance: safeWidget(() => calculateTimeOfDayPerformance(analyticsTrades, breakEvenThreshold), []),
    disciplineAnalytics: safeWidget(() => calculateDisciplineAnalytics(analyticsTrades, breakEvenThreshold), { totalTrades: 0, brokenRules: 0, ruleBrokenRate: 0, ruleCoverage: 0, avgRulesPerTaggedTrade: 0, playbooks: [] } as any),
    calendarData: widgetCalendarData,
    accountBalancePnl: safeWidget(() => calculateBalanceInfo(filteredAccounts, analyticsTrades, relevantTransactions, { pnlDisplayMode }), zeroBalanceResult),
  } : null

  return { responseTrades, statistics, calendarData, widgets }
}
