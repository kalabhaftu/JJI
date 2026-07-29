import type { StatisticsProps } from '@/app/dashboard/types/statistics'
import type { Account } from '@/context/data-provider'
import type { TradeType as Trade } from '@/lib/db/schema/trades'
import {
  calculateWinRate,
  classifyTrade,
  parsePositionTime,
} from '@/lib/trading/trade-formatting'
import {
  groupTradesByExecution,
  type GroupedTrade,
} from '@/lib/trading/trade-grouping'
import { DEFAULT_BREAK_EVEN_THRESHOLD } from '@/lib/metrics/outcome'

function emptyStatistics(breakEvenThreshold: number): StatisticsProps {
  return {
    breakEvenThreshold,
    cumulativeFees: 0,
    cumulativePnl: 0,
    winningStreak: 0,
    winRate: 0,
    nbTrades: 0,
    nbBe: 0,
    nbWin: 0,
    nbLoss: 0,
    totalPositionTime: 0,
    averagePositionTime: '0s',
    profitFactor: 0,
    grossLosses: 0,
    grossWin: 0,
    biggestWin: 0,
    biggestLoss: 0,
    averageWin: 0,
    averageLoss: 0,
    totalPayouts: 0,
    nbPayouts: 0,
    totalPnL: 0,
  }
}

export function calculateStatistics(
  trades: Trade[],
  accounts: Account[] = [],
  preGrouped?: GroupedTrade[],
  breakEvenThreshold = DEFAULT_BREAK_EVEN_THRESHOLD,
): StatisticsProps {
  if (trades.length === 0) return emptyStatistics(breakEvenThreshold)
  const groupedTrades = preGrouped ?? groupTradesByExecution(trades)
  if (groupedTrades.length === 0) return emptyStatistics(breakEvenThreshold)

  const statistics = {
    ...emptyStatistics(breakEvenThreshold),
    profitFactor: 1,
  }
  let currentWinningStreak = 0
  let maxWinningStreak = 0

  for (const trade of groupedTrades) {
    const pnl = Number(trade.pnl) || 0
    const commission = Math.abs(Number(trade.commission) || 0)
    const positionTime = Number(trade.timeInPosition) || 0
    statistics.nbTrades += 1
    statistics.cumulativePnl += pnl
    statistics.cumulativeFees += commission
    statistics.totalPositionTime += positionTime
    statistics.totalPnL = (statistics.totalPnL ?? 0) + pnl
    statistics.biggestWin = Math.max(statistics.biggestWin, pnl)
    statistics.biggestLoss = Math.min(statistics.biggestLoss, pnl)

    const outcome = classifyTrade(pnl, breakEvenThreshold)
    if (outcome === 'breakeven') {
      statistics.nbBe += 1
      currentWinningStreak = 0
    } else if (outcome === 'win') {
      statistics.nbWin += 1
      statistics.grossWin += pnl
      currentWinningStreak += 1
      maxWinningStreak = Math.max(maxWinningStreak, currentWinningStreak)
    } else {
      statistics.nbLoss += 1
      statistics.grossLosses += Math.abs(pnl)
      currentWinningStreak = 0
    }
  }

  statistics.winRate = calculateWinRate(statistics.nbWin, statistics.nbLoss)
  statistics.averageWin = statistics.nbWin > 0
    ? statistics.grossWin / statistics.nbWin
    : 0
  statistics.averageLoss = statistics.nbLoss > 0
    ? statistics.grossLosses / statistics.nbLoss
    : 0
  Object.assign(statistics, {
    avgWin: statistics.averageWin,
    avgLoss: statistics.averageLoss,
    riskRewardRatio: statistics.averageLoss > 0
      ? statistics.averageWin / statistics.averageLoss
      : 0,
  })
  statistics.winningStreak = maxWinningStreak

  const accountNumbers = new Set(
    groupedTrades.map((trade) => trade.accountNumber),
  )
  for (const account of accounts) {
    if (!accountNumbers.has(account.number)) continue
    for (const payout of account.payouts ?? []) {
      statistics.totalPayouts += payout.amount
      statistics.nbPayouts += 1
    }
  }

  statistics.averagePositionTime = parsePositionTime(
    Math.round(statistics.totalPositionTime / groupedTrades.length),
  )
  statistics.profitFactor = statistics.grossLosses > 0
    ? statistics.grossWin / statistics.grossLosses
    : statistics.grossWin > 0
      ? Number.POSITIVE_INFINITY
      : 0
  if (statistics.profitFactor !== Number.POSITIVE_INFINITY) {
    statistics.profitFactor = Math.round(statistics.profitFactor * 100) / 100
  }
  return statistics
}
