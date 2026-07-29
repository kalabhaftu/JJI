import type { TradeType } from '@/lib/db/schema/trades'
import { calculateWinRate, classifyOutcome, DEFAULT_BREAK_EVEN_THRESHOLD } from '@/lib/metrics/outcome'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { reportError } from '@/lib/observability/report-error'
import { getNewYorkHour, getTradingSession } from '@/lib/time-utils'
import { groupTradesByExecution } from '@/lib/trading/trade-grouping'

const isWinningTrade = (pnl: number, threshold: number) =>
  classifyOutcome(pnl, threshold) === 'win'
const isLosingTrade = (pnl: number, threshold: number) =>
  classifyOutcome(pnl, threshold) === 'loss'

export function calculateSessionAnalysis(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD,
) {
  const stats: Record<string, { trades: number; wins: number; pnl: number }> = {
    'New York': { trades: 0, wins: 0, pnl: 0 },
    London: { trades: 0, wins: 0, pnl: 0 },
    Asia: { trades: 0, wins: 0, pnl: 0 },
  }

  trades.forEach((trade) => {
    if (!trade.entryDate) return

    try {
      const session = getTradingSession(trade.entryDate)
      if (session && stats[session]) {
        const netPnl = getTradeNetPnl(trade)
        stats[session].trades++
        stats[session].pnl += netPnl
        if (isWinningTrade(netPnl, breakEvenThreshold)) stats[session].wins++
      }
    } catch (error) {
      reportError(error, {
        surface: 'server',
        operation: 'calculate-dashboard-analytics',
        extra: { fallbackUsed: true },
      })
    }
  })

  return stats
}

export function calculateTagPerformance(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD,
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  const tagMap: Record<string, {
    pnl: number
    trades: number
    wins: number
    losses: number
    grossWin: number
    grossLoss: number
  }> = {}

  groupedTrades.forEach((trade: any) => {
    const tags = Array.isArray(trade.tags) && trade.tags.length > 0
      ? trade.tags
      : ['Untagged']
    const netPnl = getTradeNetPnl(trade)
    tags.forEach((tag: string) => {
      if (!tagMap[tag]) {
        tagMap[tag] = {
          pnl: 0,
          trades: 0,
          wins: 0,
          losses: 0,
          grossWin: 0,
          grossLoss: 0,
        }
      }
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

  return Object.entries(tagMap)
    .map(([tag, stats]) => ({
      tag,
      ...stats,
      winRate: calculateWinRate(stats.wins, stats.losses),
      expectancy: stats.trades > 0 ? stats.pnl / stats.trades : 0,
      profitFactor: stats.grossLoss > 0
        ? stats.grossWin / stats.grossLoss
        : stats.grossWin > 0
          ? 999
          : 0,
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 12)
}

export function calculateTimeOfDayPerformance(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD,
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  const hours: Record<number, {
    hour: number
    pnl: number
    trades: number
    wins: number
    losses: number
  }> = {}
  for (let hour = 0; hour < 24; hour++) {
    hours[hour] = { hour, pnl: 0, trades: 0, wins: 0, losses: 0 }
  }

  groupedTrades.forEach((trade: any) => {
    if (!trade.entryDate) return
    const hour = getNewYorkHour(trade.entryDate)
    if (hour == null || !hours[hour]) return
    const netPnl = getTradeNetPnl(trade)
    hours[hour].pnl += netPnl
    hours[hour].trades++
    if (isWinningTrade(netPnl, breakEvenThreshold)) hours[hour].wins++
    else if (isLosingTrade(netPnl, breakEvenThreshold)) hours[hour].losses++
  })

  return Object.values(hours).map((item) => ({
    ...item,
    winRate: calculateWinRate(item.wins, item.losses),
    avgPnl: item.trades > 0 ? item.pnl / item.trades : 0,
  }))
}

export function calculateDisciplineAnalytics(
  trades: Partial<TradeType>[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD,
) {
  const groupedTrades = groupTradesByExecution(trades as any)
  let broken = 0
  let withRules = 0
  let selectedRuleCount = 0
  const modelMap: Record<string, {
    model: string
    trades: number
    pnl: number
    broken: number
  }> = {}

  groupedTrades.forEach((trade: any) => {
    const netPnl = getTradeNetPnl(trade)
    const rules = Array.isArray(trade.selectedRules) ? trade.selectedRules : []
    if (rules.length > 0) {
      withRules++
      selectedRuleCount += rules.length
    }
    if (trade.ruleBroken) broken++
    const model = trade.tradingModel || trade.TradingModel?.name || 'No Playbook'
    if (!modelMap[model]) {
      modelMap[model] = { model, trades: 0, pnl: 0, broken: 0 }
    }
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
    playbooks: Object.values(modelMap)
      .sort((a, b) => b.trades - a.trades)
      .slice(0, 8),
  }
}
