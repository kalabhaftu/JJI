import type {
  PhaseRulesInput,
  PhaseTradeInput,
} from '@/lib/prop-firm/phase-evaluation/types'

export interface HistoricalDailyDrawdown {
  isBreached: boolean
  breachDate?: string
  breachTime?: Date
  dayStartBalance: number
  dayEndBalance: number
  dayLoss: number
  dailyLimit: number
  breachAmount?: number
}

export interface HistoricalMaxDrawdown {
  isBreached: boolean
  lowestBalance: number
  minAllowedBalance: number
  maxDrawdownUsed: number
  maxDrawdownLimit: number
  breachAmount?: number
  breachTime?: Date
}

export function getDateInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function getNetPnl(trade: PhaseTradeInput): number {
  return (trade.pnl ?? 0) + (trade.commission ?? 0)
}

export function checkHistoricalDailyDrawdowns(
  rules: Pick<PhaseRulesInput, 'dailyDrawdownPercent'>,
  trades: PhaseTradeInput[],
  accountSize: number,
  timezone: string,
): HistoricalDailyDrawdown {
  const dailyLimit = accountSize * (rules.dailyDrawdownPercent / 100)
  if (trades.length === 0) {
    return {
      isBreached: false,
      dayStartBalance: accountSize,
      dayEndBalance: accountSize,
      dayLoss: 0,
      dailyLimit,
    }
  }

  const tradesByDay = new Map<string, PhaseTradeInput[]>()
  for (const trade of trades) {
    const rawDate = trade.exitTime ?? trade.createdAt
    if (!rawDate) continue
    const date = new Date(rawDate)
    if (Number.isNaN(date.getTime())) continue
    const dateKey = getDateInTimezone(date, timezone)
    const entries = tradesByDay.get(dateKey) ?? []
    entries.push(trade)
    tradesByDay.set(dateKey, entries)
  }

  let runningBalance = accountSize
  for (const dateKey of [...tradesByDay.keys()].sort()) {
    const dayStartBalance = runningBalance
    const dayPnl = (tradesByDay.get(dateKey) ?? [])
      .reduce((sum, trade) => sum + getNetPnl(trade), 0)
    const dayEndBalance = dayStartBalance + dayPnl
    const dayLoss = dayPnl < 0 ? Math.abs(dayPnl) : 0

    if (dayLoss > dailyLimit) {
      return {
        isBreached: true,
        breachDate: dateKey,
        breachTime: new Date(`${dateKey}T00:00:00.000Z`),
        dayStartBalance,
        dayEndBalance,
        dayLoss,
        dailyLimit,
        breachAmount: dayLoss - dailyLimit,
      }
    }

    runningBalance = dayEndBalance
  }

  return {
    isBreached: false,
    dayStartBalance: accountSize,
    dayEndBalance: runningBalance,
    dayLoss: 0,
    dailyLimit,
  }
}

export function checkHistoricalMaxDrawdown(
  trades: PhaseTradeInput[],
  accountSize: number,
  maxDrawdownPercent: number,
  maxDrawdownType: string,
): HistoricalMaxDrawdown {
  const sortedTrades = [...trades].sort((left, right) => {
    const leftTime = left.exitTime ? new Date(left.exitTime).getTime() : 0
    const rightTime = right.exitTime ? new Date(right.exitTime).getTime() : 0
    return leftTime - rightTime
  })

  let runningBalance = accountSize
  let lowestBalance = accountSize
  let highWaterMark = accountSize
  let breachTime: Date | undefined

  for (const trade of sortedTrades) {
    runningBalance += getNetPnl(trade)
    highWaterMark = Math.max(highWaterMark, runningBalance)
    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance
      const rawDate = trade.exitTime ?? trade.createdAt
      breachTime = rawDate ? new Date(rawDate) : undefined
    }
  }

  const drawdownBase = maxDrawdownType === 'trailing'
    ? highWaterMark
    : accountSize
  const maxDrawdownLimit = drawdownBase * (maxDrawdownPercent / 100)
  const minAllowedBalance = drawdownBase - maxDrawdownLimit
  const maxDrawdownUsed = accountSize - lowestBalance
  const isBreached = lowestBalance < minAllowedBalance
  const breachAmount = isBreached
    ? minAllowedBalance - lowestBalance
    : undefined

  return {
    isBreached,
    lowestBalance,
    minAllowedBalance,
    maxDrawdownUsed,
    maxDrawdownLimit,
    ...(breachAmount !== undefined ? { breachAmount } : {}),
    ...(isBreached && breachTime ? { breachTime } : {}),
  }
}
