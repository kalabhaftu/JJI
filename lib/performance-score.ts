import { groupTradesByExecution } from '@/lib/utils'
import { classifyOutcome, DEFAULT_BREAK_EVEN_THRESHOLD, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { 
  calculateRSquared, 
  calculatePeakToTroughDrawdown, 
  calculateRecoveryFactor,
  calculateProfitFactor,
  calculateExpectancy 
} from '@/lib/math/performance-metrics'

/**
 * Performance Score Calculation
 * Comprehensive trading performance scoring system
 * 
 * Combines 6 key trading metrics with specific weights:
 * - Recovery Factor: 10%
 * - Trade Win %: 15%
 * - Average Win/Loss: 20%
 * - Profit Factor: 25%
 * - Max Drawdown: 20%
 * - Consistency Score: 10%
 */

export interface PerformanceScoreMetrics {
  avgWinLoss: number
  tradeWinPercentage: number
  maxDrawdown: number
  profitFactor: number
  recoveryFactor: number
  consistencyScore: number
}

export interface PerformanceScoreResult {
  overallScore: number
  metrics: {
    avgWinLoss: number
    tradeWinPercentage: number
    maxDrawdown: number
    profitFactor: number
    recoveryFactor: number
    consistencyScore: number
  }
  breakdown: {
    avgWinLossScore: number
    tradeWinPercentageScore: number
    maxDrawdownScore: number
    profitFactorScore: number
    recoveryFactorScore: number
    consistencyScoreValue: number
  }
}

/**
 * Calculate Average Win/Loss Ratio Score
 * Scoring formula for average win/loss ratio
 * REALISTIC thresholds for actual traders:
 * - 1.0-1.2: Breakeven to slight edge (30-40 points)
 * - 1.2-1.5: Decent edge (40-60 points)
 * - 1.5-2.0: Good edge (60-80 points)
 * - 2.0+: Excellent edge (80-100 points)
 */
function calculateAvgWinLossScore(avgWinLoss: number): number {
  if (avgWinLoss >= 3.0) return 100
  if (avgWinLoss >= 2.5) return 95 + ((avgWinLoss - 2.5) / 0.5) * 5
  if (avgWinLoss >= 2.0) return 85 + ((avgWinLoss - 2.0) / 0.5) * 10
  if (avgWinLoss >= 1.8) return 75 + ((avgWinLoss - 1.8) / 0.2) * 10
  if (avgWinLoss >= 1.5) return 60 + ((avgWinLoss - 1.5) / 0.3) * 15
  if (avgWinLoss >= 1.2) return 45 + ((avgWinLoss - 1.2) / 0.3) * 15
  if (avgWinLoss >= 1.0) return 30 + ((avgWinLoss - 1.0) / 0.2) * 15
  if (avgWinLoss >= 0.8) return 15 + ((avgWinLoss - 0.8) / 0.2) * 15
  return Math.max(0, avgWinLoss * 15) // Below 0.8 scales to zero
}

/**
 * Calculate Trade Win Percentage Score
 * REALISTIC thresholds - Win rate alone doesn't determine profitability
 * - 30-40%: Acceptable if R:R is good (30-50 points)
 * - 40-50%: Good (50-70 points)
 * - 50-60%: Very good (70-90 points)
 * - 60%+: Excellent (90-100 points)
 */
function calculateTradeWinPercentageScore(
  tradeWinPercentage: number,
  topThreshold: number = 70 // More realistic top threshold
): number {
  if (tradeWinPercentage >= 70) return 100
  if (tradeWinPercentage >= 60) return 90 + ((tradeWinPercentage - 60) / 10) * 10
  if (tradeWinPercentage >= 50) return 70 + ((tradeWinPercentage - 50) / 10) * 20
  if (tradeWinPercentage >= 40) return 50 + ((tradeWinPercentage - 40) / 10) * 20
  if (tradeWinPercentage >= 30) return 30 + ((tradeWinPercentage - 30) / 10) * 20
  if (tradeWinPercentage >= 20) return 15 + ((tradeWinPercentage - 20) / 10) * 15
  return Math.max(0, (tradeWinPercentage / 20) * 15)
}

/**
 * Calculate Maximum Drawdown Score
 * Formula: 100 - ((Max Drawdown / Peak P&L) × 100)
 * Lower drawdown = better score
 */
function calculateMaxDrawdownScore(maxDrawdownPercent: number): number {
  return Math.max(0, 100 - maxDrawdownPercent)
}

/**
 * Calculate Profit Factor Score
 * Scoring formula for profit factor
 * REALISTIC thresholds - Profit Factor is the KING metric:
 * - 1.0: Breakeven (0 points) - not profitable
 * - 1.0-1.2: Barely profitable (30-50 points)
 * - 1.2-1.5: Decent profitability (50-70 points)
 * - 1.5-2.0: Good profitability (70-85 points)
 * - 2.0+: Excellent profitability (85-100 points)
 */
function calculateProfitFactorScore(profitFactor: number): number {
  if (profitFactor >= 3.0) return 100
  if (profitFactor >= 2.5) return 95 + ((profitFactor - 2.5) / 0.5) * 5
  if (profitFactor >= 2.0) return 85 + ((profitFactor - 2.0) / 0.5) * 10
  if (profitFactor >= 1.8) return 78 + ((profitFactor - 1.8) / 0.2) * 7
  if (profitFactor >= 1.5) return 70 + ((profitFactor - 1.5) / 0.3) * 8
  if (profitFactor >= 1.3) return 60 + ((profitFactor - 1.3) / 0.2) * 10
  if (profitFactor >= 1.2) return 50 + ((profitFactor - 1.2) / 0.1) * 10
  if (profitFactor >= 1.1) return 40 + ((profitFactor - 1.1) / 0.1) * 10
  if (profitFactor >= 1.0) return 30 + ((profitFactor - 1.0) / 0.1) * 10
  if (profitFactor >= 0.9) return 15 + ((profitFactor - 0.9) / 0.1) * 15
  return Math.max(0, profitFactor * 15) // Below 0.9 scales to zero
}

/**
 * Calculate Recovery Factor Score
 * Scoring formula for recovery factor (Net Profit / Max Drawdown)
 * REALISTIC thresholds:
 * - 0.5-1.0: Weak recovery (20-40 points)
 * - 1.0-2.0: Decent recovery (40-70 points)
 * - 2.0-3.0: Good recovery (70-90 points)
 * - 3.0+: Excellent recovery (90-100 points)
 */
function calculateRecoveryFactorScore(recoveryFactor: number): number {
  if (recoveryFactor >= 5.0) return 100
  if (recoveryFactor >= 4.0) return 95 + ((recoveryFactor - 4.0) / 1.0) * 5
  if (recoveryFactor >= 3.0) return 85 + ((recoveryFactor - 3.0) / 1.0) * 10
  if (recoveryFactor >= 2.5) return 78 + ((recoveryFactor - 2.5) / 0.5) * 7
  if (recoveryFactor >= 2.0) return 70 + ((recoveryFactor - 2.0) / 0.5) * 8
  if (recoveryFactor >= 1.5) return 60 + ((recoveryFactor - 1.5) / 0.5) * 10
  if (recoveryFactor >= 1.0) return 40 + ((recoveryFactor - 1.0) / 0.5) * 20
  if (recoveryFactor >= 0.5) return 20 + ((recoveryFactor - 0.5) / 0.5) * 20
  if (recoveryFactor > 0) return Math.max(5, recoveryFactor * 40)
  return 0
}

/**
 * Consistency Score (Input Value)
 * Now calculated via R-Squared in calculateMetricsFromTrades
 */

/**
 * Calculate Complete Performance Score
 * Weighted combination of all metrics
 */
export function calculatePerformanceScore(metrics: PerformanceScoreMetrics): PerformanceScoreResult {
  const avgWinLossScore = calculateAvgWinLossScore(metrics.avgWinLoss)
  const tradeWinPercentageScore = calculateTradeWinPercentageScore(metrics.tradeWinPercentage)
  const maxDrawdownScore = calculateMaxDrawdownScore(metrics.maxDrawdown)
  const profitFactorScore = calculateProfitFactorScore(metrics.profitFactor)
  const recoveryFactorScore = calculateRecoveryFactorScore(metrics.recoveryFactor)
  const consistencyScoreValue = metrics.consistencyScore // Already calculated

  // Weighted scores
  const weights = {
    recoveryFactor: 0.10,      // 10%
    tradeWinPercentage: 0.15,  // 15%
    avgWinLoss: 0.20,          // 20%
    profitFactor: 0.25,        // 25%
    maxDrawdown: 0.20,         // 20%
    consistencyScore: 0.10     // 10%
  }

  const overallScore = Math.round(
    recoveryFactorScore * weights.recoveryFactor +
    tradeWinPercentageScore * weights.tradeWinPercentage +
    avgWinLossScore * weights.avgWinLoss +
    profitFactorScore * weights.profitFactor +
    maxDrawdownScore * weights.maxDrawdown +
    consistencyScoreValue * weights.consistencyScore
  )

  return {
    overallScore,
    metrics,
    breakdown: {
      avgWinLossScore,
      tradeWinPercentageScore,
      maxDrawdownScore,
      profitFactorScore,
      recoveryFactorScore,
      consistencyScoreValue
    }
  }
}

/**
 * Calculate metrics from trade data
 */
export interface Trade {
  pnl: number
  commission?: number
  entryDate: string
}

export function calculateMetricsFromTrades(
  trades: Trade[],
  breakEvenThresholdInput: number = DEFAULT_BREAK_EVEN_THRESHOLD
): PerformanceScoreMetrics | null {
  if (trades.length < 10) {
    return null
  }

  const groupedTrades = groupTradesByExecution(trades as any)
  if (groupedTrades.length < 10) {
    return null
  }

  const breakEvenThreshold = getBreakEvenThreshold(breakEvenThresholdInput)

  const wins = groupedTrades.filter((t: any) => {
    return classifyOutcome(Number(t.pnl || 0), breakEvenThreshold) === 'win'
  })

  const losses = groupedTrades.filter((t: any) => {
    return classifyOutcome(Number(t.pnl || 0), breakEvenThreshold) === 'loss'
  })

  const grossWin = wins.reduce((sum: number, t: any) => sum + Number(t.pnl || 0), 0)
  const grossLoss = Math.abs(losses.reduce((sum: number, t: any) => sum + Number(t.pnl || 0), 0))

  const avgWin = wins.length > 0 ? grossWin / wins.length : 0
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0
  const avgWinLoss = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 5 : 0

  const tradableCount = wins.length + losses.length
  const tradeWinPercentage = tradableCount > 0 ? (wins.length / tradableCount) * 100 : 0

  const sortedTrades = [...groupedTrades].sort((a, b) =>
    new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
  )

  const pnls = sortedTrades.map((t: any) => Number(t.pnl || 0))
  const { maxDrawdown, peak } = calculatePeakToTroughDrawdown(pnls)
  const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0

  const netProfit = pnls.reduce((sum: number, pnl: number) => sum + pnl, 0)
  const recoveryFactor = calculateRecoveryFactor(netProfit, maxDrawdown)
  const profitFactor = calculateProfitFactor(grossWin, grossLoss)

  let currentEquity = 0
  const equityCurve = pnls.map((pnl: number) => {
    currentEquity += pnl
    return currentEquity
  })
  const consistencyScore = calculateRSquared(equityCurve)

  return {
    avgWinLoss,
    tradeWinPercentage,
    maxDrawdown: maxDrawdownPercent,
    profitFactor,
    recoveryFactor,
    consistencyScore
  }
}

