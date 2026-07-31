import { useMemo } from 'react'
import { useData } from '@/context/data-provider'
import { groupTradesByExecution } from '@/lib/utils'

function toNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isNaN(num) ? fallback : num
}

/**
 * Custom hook that provides all trading statistics calculations
 * 
 * REFACTORED: Statistics now come strictly from the server via DataProvider.
 * Removed redundant client-side win/loss math to ensure 100% consistency.
 */
export function useTradeStatistics() {
  const { formattedTrades, accounts, statistics } = useData()
  const normalizedStatistics = useMemo(() => ({
    ...statistics,
    profitFactor: toNumber((statistics as any)?.profitFactor, 0),
    grossWin: toNumber((statistics as any)?.grossWin, 0),
    grossLosses: toNumber((statistics as any)?.grossLosses, 0),
    avgWin: toNumber((statistics as any)?.avgWin, 0),
    avgLoss: toNumber((statistics as any)?.avgLoss, 0),
    riskRewardRatio: toNumber((statistics as any)?.riskRewardRatio, 0),
    nbWin: toNumber((statistics as any)?.nbWin, 0),
    nbLoss: toNumber((statistics as any)?.nbLoss, 0),
    nbBe: toNumber((statistics as any)?.nbBe, 0),
    nbTrades: toNumber((statistics as any)?.nbTrades, 0),
    cumulativePnl: toNumber((statistics as any)?.cumulativePnl, 0),
    cumulativeFees: toNumber((statistics as any)?.cumulativeFees, 0),
    totalPayouts: toNumber((statistics as any)?.totalPayouts, 0),
  }), [statistics])

  // Group trades by execution for advanced display calculations (if needed by components)
  const groupedTrades = useMemo(
    () => groupTradesByExecution(formattedTrades) as any[],
    [formattedTrades]
  )

  // Derive additional stats from server-computed statistics
  const derivedStats = useMemo(() => {
    const {
      nbWin,
      nbLoss,
      nbBe,
      nbTrades,
      cumulativePnl,
      cumulativeFees,
      totalPayouts,
      winningStreak,
    } = normalizedStatistics

    const netPnlWithPayouts = Number(cumulativePnl || 0) - Number(cumulativeFees || 0) - Number(totalPayouts || 0)
    const tradableTradesCount = Number(nbWin || 0) + Number(nbLoss || 0)
    const winRate = tradableTradesCount > 0 ? Math.round((Number(nbWin || 0) / tradableTradesCount) * 1000) / 10 : 0
    const lossRate = Number(nbTrades || 0) > 0 ? Math.round((Number(nbLoss || 0) / Number(nbTrades || 0)) * 1000) / 10 : 0
    const beRate = Number(nbTrades || 0) > 0 ? Math.round((Number(nbBe || 0) / Number(nbTrades || 0)) * 1000) / 10 : 0

    // Server stats safely cast
    const stats = normalizedStatistics as any
    
    return {
      netPnlWithPayouts,
      winRate,
      lossRate,
      beRate,
      winningStreak,
      biggestWin: stats.biggestWin ?? 0,
      biggestLoss: stats.biggestLoss ?? 0,
      avgWin: stats.avgWin ?? 0,
      avgLoss: stats.avgLoss ?? 0,
      riskRewardRatio: stats.riskRewardRatio ?? 0,
      currentTradeStreak: stats.currentTradeStreak ?? 0,
      bestTradeStreak: stats.bestTradeStreak ?? 0,
      worstTradeStreak: stats.worstTradeStreak ?? 0,
      currentDayStreak: stats.currentDayStreak ?? 0,
      bestDayStreak: stats.bestDayStreak ?? 0,
      worstDayStreak: stats.worstDayStreak ?? 0,
    }
  }, [normalizedStatistics])

  return {
    ...normalizedStatistics,
    ...derivedStats,
    isLoadingServerStats: false,
    serverError: null,
    refetchServerStats: () => {},
    formattedTrades,
    accounts,
    groupedTrades
  }
}
