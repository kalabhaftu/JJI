import {
  checkHistoricalDailyDrawdowns,
  checkHistoricalMaxDrawdown,
  getNetPnl,
} from '@/lib/prop-firm/phase-evaluation/breach'
import { calculateDrawdown } from '@/lib/prop-firm/phase-evaluation/drawdown'
import { calculatePhaseProgress } from '@/lib/prop-firm/phase-evaluation/progress'
import type {
  DrawdownCalculation,
  PhaseEvaluationMetrics,
  PhaseEvaluationResult,
  PhaseMasterInput,
  PhaseProgress,
  PhaseRiskAlert,
  PhaseRulesInput,
  PhaseTradeInput,
} from '@/lib/prop-firm/phase-evaluation/types'

function buildRiskAlert(
  master: PhaseMasterInput,
  phaseAccountId: string,
  riskType: 'daily_loss' | 'max_drawdown',
  percentage: number,
  currentBalance: number,
  limit: number,
  used: number,
): PhaseRiskAlert {
  return {
    userId: master.userId,
    phaseAccountId,
    riskType,
    currentPercentage: percentage,
    metadata: {
      accountName: master.accountName,
      currentBalance,
      limit,
      used,
    },
  }
}

function failureResult(
  drawdown: DrawdownCalculation,
  progress: PhaseProgress,
  alert: PhaseRiskAlert,
): PhaseEvaluationResult {
  return {
    drawdown,
    progress,
    isFailed: true,
    isPassed: false,
    canAdvance: false,
    nextAction: 'fail',
    alerts: [alert],
  }
}

export function buildPhaseEvaluationMetrics(
  rules: PhaseRulesInput,
  trades: PhaseTradeInput[],
  master: PhaseMasterInput,
  evaluatedAt: Date,
): PhaseEvaluationMetrics {
  const currentPnl = trades.reduce(
    (sum, trade) => sum + getNetPnl(trade),
    0,
  )
  let runningBalance = master.accountSize
  let highWaterMark = master.accountSize
  for (const trade of trades) {
    runningBalance += getNetPnl(trade)
    highWaterMark = Math.max(highWaterMark, runningBalance)
  }

  return {
    currentPnl,
    currentEquity: master.accountSize + currentPnl,
    highWaterMark,
    progress: calculatePhaseProgress(
      rules,
      currentPnl,
      trades,
      evaluatedAt,
    ),
  }
}

export function evaluateHistoricalBreaches(
  phaseAccountId: string,
  rules: PhaseRulesInput,
  trades: PhaseTradeInput[],
  master: PhaseMasterInput,
  metrics: PhaseEvaluationMetrics,
  timezone = 'UTC',
): PhaseEvaluationResult | null {
  const historicalDaily = checkHistoricalDailyDrawdowns(
    rules,
    trades,
    master.accountSize,
    timezone,
  )
  if (historicalDaily.isBreached) {
    const maxDrawdownUsed = master.accountSize - metrics.currentEquity
    const maxDrawdownLimit = (
      master.accountSize
      * (rules.maxDrawdownPercent / 100)
    )
    const drawdown: DrawdownCalculation = {
      currentEquity: metrics.currentEquity,
      dailyStartBalance: historicalDaily.dayStartBalance,
      highWaterMark: metrics.highWaterMark,
      dailyDrawdownUsed: historicalDaily.dayLoss,
      dailyDrawdownLimit: historicalDaily.dailyLimit,
      dailyDrawdownRemaining: 0,
      dailyDrawdownPercent: historicalDaily.dayStartBalance > 0
        ? (historicalDaily.dayLoss / historicalDaily.dayStartBalance) * 100
        : 0,
      maxDrawdownUsed,
      maxDrawdownLimit,
      maxDrawdownRemaining: Math.max(
        0,
        maxDrawdownLimit - maxDrawdownUsed,
      ),
      maxDrawdownPercent: (
        (maxDrawdownUsed / master.accountSize) * 100
      ),
      isBreached: true,
      breachType: 'daily_drawdown',
      ...(historicalDaily.breachAmount !== undefined
        ? { breachAmount: historicalDaily.breachAmount }
        : {}),
      ...(historicalDaily.breachTime
        ? { breachTime: historicalDaily.breachTime }
        : {}),
    }
    return failureResult(
      drawdown,
      metrics.progress,
      buildRiskAlert(
        master,
        phaseAccountId,
        'daily_loss',
        100,
        historicalDaily.dayEndBalance,
        historicalDaily.dailyLimit,
        historicalDaily.dayLoss,
      ),
    )
  }

  const historicalMax = checkHistoricalMaxDrawdown(
    trades,
    master.accountSize,
    rules.maxDrawdownPercent,
    rules.maxDrawdownType ?? '',
  )
  if (!historicalMax.isBreached) return null

  const dailyLimit = (
    master.accountSize
    * (rules.dailyDrawdownPercent / 100)
  )
  const drawdown: DrawdownCalculation = {
    currentEquity: metrics.currentEquity,
    dailyStartBalance: master.accountSize,
    highWaterMark: metrics.highWaterMark,
    dailyDrawdownUsed: 0,
    dailyDrawdownLimit: dailyLimit,
    dailyDrawdownRemaining: dailyLimit,
    dailyDrawdownPercent: 0,
    maxDrawdownUsed: historicalMax.maxDrawdownUsed,
    maxDrawdownLimit: historicalMax.maxDrawdownLimit,
    maxDrawdownRemaining: 0,
    maxDrawdownPercent: (
      historicalMax.maxDrawdownUsed / master.accountSize
    ) * 100,
    isBreached: true,
    breachType: 'max_drawdown',
    ...(historicalMax.breachAmount !== undefined
      ? { breachAmount: historicalMax.breachAmount }
      : {}),
    ...(historicalMax.breachTime
      ? { breachTime: historicalMax.breachTime }
      : {}),
  }
  return failureResult(
    drawdown,
    metrics.progress,
    buildRiskAlert(
      master,
      phaseAccountId,
      'max_drawdown',
      100,
      historicalMax.lowestBalance,
      historicalMax.maxDrawdownLimit,
      historicalMax.maxDrawdownUsed,
    ),
  )
}

export function evaluateCurrentPhase(
  phaseAccountId: string,
  rules: PhaseRulesInput,
  master: PhaseMasterInput,
  metrics: PhaseEvaluationMetrics,
  dailyStartBalance: number,
  evaluatedAt: Date,
): PhaseEvaluationResult {
  const drawdown = calculateDrawdown(
    rules,
    metrics.currentEquity,
    dailyStartBalance,
    metrics.highWaterMark,
    master.accountSize,
    evaluatedAt,
  )
  const alerts: PhaseRiskAlert[] = []
  if (
    drawdown.dailyDrawdownPercent >= 80
    && drawdown.dailyDrawdownPercent < 100
    && !drawdown.isBreached
  ) {
    alerts.push(buildRiskAlert(
      master,
      phaseAccountId,
      'daily_loss',
      drawdown.dailyDrawdownPercent,
      metrics.currentEquity,
      drawdown.dailyDrawdownLimit,
      drawdown.dailyDrawdownUsed,
    ))
  }
  if (
    drawdown.maxDrawdownPercent >= 80
    && drawdown.maxDrawdownPercent < 100
    && !drawdown.isBreached
  ) {
    alerts.push(buildRiskAlert(
      master,
      phaseAccountId,
      'max_drawdown',
      drawdown.maxDrawdownPercent,
      metrics.currentEquity,
      drawdown.maxDrawdownLimit,
      drawdown.maxDrawdownUsed,
    ))
  }

  if (drawdown.isBreached) {
    const riskType = drawdown.breachType === 'daily_drawdown'
      ? 'daily_loss'
      : 'max_drawdown'
    return failureResult(
      drawdown,
      metrics.progress,
      buildRiskAlert(
        master,
        phaseAccountId,
        riskType,
        100,
        metrics.currentEquity,
        riskType === 'daily_loss'
          ? drawdown.dailyDrawdownLimit
          : drawdown.maxDrawdownLimit,
        riskType === 'daily_loss'
          ? drawdown.dailyDrawdownUsed
          : drawdown.maxDrawdownUsed,
      ),
    )
  }

  const canAdvance = (
    metrics.progress.canPassPhase
    && metrics.progress.isEligibleForAdvancement
  )
  return {
    drawdown,
    progress: metrics.progress,
    isFailed: false,
    isPassed: canAdvance,
    canAdvance,
    nextAction: canAdvance ? 'advance' : 'continue',
    alerts,
  }
}
