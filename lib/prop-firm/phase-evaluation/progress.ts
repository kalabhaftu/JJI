import { getDateInTimezone } from '@/lib/prop-firm/phase-evaluation/breach'
import type {
  PhaseProgress,
  PhaseRulesInput,
  PhaseTradeInput,
} from '@/lib/prop-firm/phase-evaluation/types'

export function calculatePhaseProgress(
  rules: PhaseRulesInput,
  currentPnl: number,
  trades: PhaseTradeInput[],
  evaluatedAt: Date = new Date(),
): PhaseProgress {
  const accountSize = rules.MasterAccount?.accountSize
    ?? rules.masterAccount?.accountSize
    ?? 0
  const profitTargetAmount = accountSize * (rules.profitTargetPercent / 100)
  const profitTargetRemaining = Math.max(0, profitTargetAmount - currentPnl)
  const profitTargetPercent = profitTargetAmount > 0
    ? (currentPnl / profitTargetAmount) * 100
    : 100

  const tradingDates = new Set(
    trades.flatMap((trade) => {
      const rawDate = trade.exitTime ?? trade.createdAt
      if (!rawDate) return []
      const date = new Date(rawDate)
      return Number.isNaN(date.getTime())
        ? []
        : [getDateInTimezone(date, 'UTC')]
    }),
  )
  const tradingDaysCompleted = tradingDates.size
  const minTradingDaysRequired = rules.minTradingDays ?? 0

  let isWithinTimeLimit = true
  let daysRemaining: number | undefined
  if (rules.timeLimitDays && rules.startDate) {
    const phaseStartDate = new Date(rules.startDate)
    const daysSinceStart = Math.floor(
      (evaluatedAt.getTime() - phaseStartDate.getTime()) / 86_400_000,
    )
    daysRemaining = rules.timeLimitDays - daysSinceStart
    isWithinTimeLimit = daysSinceStart <= rules.timeLimitDays
  }

  const isProfitTargetMet = rules.profitTargetPercent === 0
    || currentPnl >= profitTargetAmount
  const areMinTradingDaysMet = tradingDaysCompleted >= minTradingDaysRequired
  const canPassPhase = (
    isProfitTargetMet
    && areMinTradingDaysMet
    && isWithinTimeLimit
  )

  return {
    currentPnL: currentPnl,
    profitTargetAmount,
    profitTargetRemaining,
    profitTargetPercent,
    tradingDaysCompleted,
    minTradingDaysRequired,
    isEligibleForAdvancement: canPassPhase,
    canPassPhase,
    ...(daysRemaining !== undefined ? { daysRemaining } : {}),
  }
}
