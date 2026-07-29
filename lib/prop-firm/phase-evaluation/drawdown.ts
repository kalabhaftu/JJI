import type {
  DrawdownCalculation,
  PhaseRulesInput,
} from '@/lib/prop-firm/phase-evaluation/types'

export function calculateDrawdown(
  rules: PhaseRulesInput,
  currentEquity: number,
  dailyStartBalance: number,
  highWaterMark: number,
  accountSize: number,
  evaluatedAt: Date = new Date(),
): DrawdownCalculation {
  const dailyDrawdownLimit = accountSize * (rules.dailyDrawdownPercent / 100)
  const dailyDrawdownUsed = Math.max(0, dailyStartBalance - currentEquity)
  const dailyDrawdownRemaining = Math.max(
    0,
    dailyDrawdownLimit - dailyDrawdownUsed,
  )
  const dailyDrawdownPercent = dailyStartBalance > 0
    ? (dailyDrawdownUsed / dailyStartBalance) * 100
    : 0

  const maxDrawdownBase = rules.maxDrawdownType === 'trailing'
    ? highWaterMark
    : accountSize
  const maxDrawdownLimit = maxDrawdownBase * (rules.maxDrawdownPercent / 100)
  const maxDrawdownUsed = Math.max(0, maxDrawdownBase - currentEquity)
  const maxDrawdownRemaining = Math.max(
    0,
    maxDrawdownLimit - maxDrawdownUsed,
  )
  const maxDrawdownPercent = maxDrawdownBase > 0
    ? (maxDrawdownUsed / maxDrawdownBase) * 100
    : 0

  let breachType: DrawdownCalculation['breachType']
  let breachAmount: number | undefined
  if (dailyDrawdownUsed > dailyDrawdownLimit) {
    breachType = 'daily_drawdown'
    breachAmount = dailyDrawdownUsed - dailyDrawdownLimit
  } else if (maxDrawdownUsed > maxDrawdownLimit) {
    breachType = 'max_drawdown'
    breachAmount = maxDrawdownUsed - maxDrawdownLimit
  }

  return {
    currentEquity,
    dailyStartBalance,
    highWaterMark,
    dailyDrawdownUsed,
    dailyDrawdownLimit,
    dailyDrawdownRemaining,
    dailyDrawdownPercent,
    maxDrawdownUsed,
    maxDrawdownLimit,
    maxDrawdownRemaining,
    maxDrawdownPercent,
    isBreached: breachType !== undefined,
    ...(breachType ? { breachType, breachTime: evaluatedAt } : {}),
    ...(breachAmount !== undefined ? { breachAmount } : {}),
  }
}
