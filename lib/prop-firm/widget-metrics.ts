import { formatInTimeZone } from 'date-fns-tz'
import { classifyOutcome } from '@/lib/metrics/outcome'
import { getTradeNetPnl } from '@/lib/metrics/pnl'

const DEFAULT_PROP_FIRM_RESET_TIMEZONE = 'UTC'

export type PropFirmWidgetTrade = {
  id: string
  pnl?: number | string | null
  commission?: number | string | null
  netPnL?: number | string | null
  entryDate?: string | Date | null
  closeDate?: string | Date | null
  entryTime?: string | Date | null
  exitTime?: string | Date | null
}

export function getPropFirmDateKey(date: Date, timezone = DEFAULT_PROP_FIRM_RESET_TIMEZONE) {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd')
}

export function getPropFirmTradeTimestamp(trade: PropFirmWidgetTrade) {
  const value = trade.exitTime || trade.closeDate || trade.entryTime || trade.entryDate
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function getPropFirmTradeNetPnl(trade: PropFirmWidgetTrade) {
  if (trade.netPnL != null) return Number(trade.netPnL) || 0
  return getTradeNetPnl(trade as any)
}

export function buildPropFirmTodayStats(trades: PropFirmWidgetTrade[], timezone = DEFAULT_PROP_FIRM_RESET_TIMEZONE, now = new Date()) {
  const todayKey = getPropFirmDateKey(now, timezone)
  const todayTrades = trades.filter((trade) => {
    const timestamp = getPropFirmTradeTimestamp(trade)
    return timestamp ? getPropFirmDateKey(timestamp, timezone) === todayKey : false
  })
  const pnls = todayTrades.map(getPropFirmTradeNetPnl)
  const wins = pnls.filter((pnl) => classifyOutcome(pnl, 0) === 'win').length
  const losses = pnls.filter((pnl) => classifyOutcome(pnl, 0) === 'loss').length
  const breakeven = Math.max(0, todayTrades.length - wins - losses)
  const pnl = pnls.reduce((sum, value) => sum + value, 0)

  return {
    pnl,
    trades: todayTrades.length,
    wins,
    losses,
    breakeven,
    winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
    bestTrade: pnls.length ? Math.max(...pnls) : 0,
    worstTrade: pnls.length ? Math.min(...pnls) : 0,
    averageTrade: pnls.length ? pnl / pnls.length : 0,
  }
}

export function buildPropFirmAccountExtremes(trades: PropFirmWidgetTrade[]) {
  const pnls = trades.map(getPropFirmTradeNetPnl)
  const pnl = pnls.reduce((sum, value) => sum + value, 0)

  return {
    bestTrade: pnls.length ? Math.max(...pnls) : 0,
    worstTrade: pnls.length ? Math.min(...pnls) : 0,
    averageTrade: pnls.length ? pnl / pnls.length : 0,
  }
}

export function buildPropFirmGrowth(account: any, trades: PropFirmWidgetTrade[], timezone = DEFAULT_PROP_FIRM_RESET_TIMEZONE) {
  const accountSize = Number(account?.accountSize || 0)
  let runningPnl = 0
  let peakEquity = accountSize
  let maxDrawdown = 0
  const dayKeys = new Set<string>()

  const points = [...trades]
    .sort((a, b) => (getPropFirmTradeTimestamp(a)?.getTime() || 0) - (getPropFirmTradeTimestamp(b)?.getTime() || 0))
    .map((trade, index) => {
      const timestamp = getPropFirmTradeTimestamp(trade) || new Date()
      dayKeys.add(getPropFirmDateKey(timestamp, timezone))
      runningPnl += getPropFirmTradeNetPnl(trade)
      const balance = accountSize + runningPnl
      peakEquity = Math.max(peakEquity, balance)
      maxDrawdown = Math.max(maxDrawdown, peakEquity - balance)
      return {
        label: `${index + 1}`,
        timestamp: timestamp.getTime(),
        balance,
        pnl: runningPnl,
        tradePnl: getPropFirmTradeNetPnl(trade),
      }
    })

  return { points, peakEquity, maxDrawdown, tradingDays: dayKeys.size }
}

function findFirstBreach(account: any, trades: PropFirmWidgetTrade[], timezone = DEFAULT_PROP_FIRM_RESET_TIMEZONE) {
  const accountSize = Number(account?.accountSize || 0)
  const phase = account?.currentPhase || {}
  const dailyDrawdownPercent = Number(phase.dailyDrawdownPercent || 0)
  const maxDrawdownPercent = Number(phase.maxDrawdownPercent || 0)
  const maxDrawdownType = phase.maxDrawdownType || 'static'
  const dailyLimit = accountSize * (dailyDrawdownPercent / 100)

  const sortedTrades = [...trades].sort((a, b) => {
    const timeA = getPropFirmTradeTimestamp(a)?.getTime() || 0
    const timeB = getPropFirmTradeTimestamp(b)?.getTime() || 0
    return timeA - timeB
  })

  let runningBalance = accountSize
  let highWaterMark = accountSize
  let currentDayKey: string | null = null
  let dailyStartBalance = accountSize

  for (const trade of sortedTrades) {
    const timestamp = getPropFirmTradeTimestamp(trade)
    if (!timestamp) continue
    const dateKey = getPropFirmDateKey(timestamp, timezone)

    if (currentDayKey === null) {
      currentDayKey = dateKey
      dailyStartBalance = runningBalance
    } else if (dateKey !== currentDayKey) {
      currentDayKey = dateKey
      dailyStartBalance = runningBalance
    }

    const netPnl = getPropFirmTradeNetPnl(trade)
    runningBalance += netPnl
    highWaterMark = Math.max(highWaterMark, runningBalance)

    const dailyLossFloor = dailyStartBalance - dailyLimit
    const maxDrawdownLimit = accountSize * (maxDrawdownPercent / 100)
    const maxLossFloor = maxDrawdownType === 'trailing'
      ? highWaterMark - maxDrawdownLimit
      : accountSize - maxDrawdownLimit

    const dailyDrawdownUsed = Math.max(0, dailyStartBalance - runningBalance)
    const dailyBreached = dailyDrawdownPercent > 0 && dailyDrawdownUsed > dailyLimit

    const maxDrawdownUsed = Math.max(0, (maxDrawdownType === 'trailing' ? highWaterMark : accountSize) - runningBalance)
    const maxBreached = maxDrawdownPercent > 0 && maxDrawdownUsed > maxDrawdownLimit

    if (dailyBreached || maxBreached) {
      return {
        isBreached: true,
        breachType: dailyBreached && maxBreached
          ? 'daily_and_max_drawdown'
          : dailyBreached
            ? 'daily_drawdown'
            : 'max_drawdown',
        dailyStartBalance,
        dailyDrawdownUsed,
        dailyLossFloor,
        dailyLimit,
        notes: dailyBreached && maxBreached
          ? 'Daily and Max Drawdown Limits exceeded'
          : dailyBreached
            ? `Daily Drawdown Limit exceeded by $${(dailyDrawdownUsed - dailyLimit).toFixed(2)}`
            : `Max Drawdown Limit exceeded by $${(maxDrawdownUsed - maxDrawdownLimit).toFixed(2)}`
      }
    }
  }

  return null
}

export function buildPropFirmDailyDrawdown(
  account: any,
  trades: PropFirmWidgetTrade[],
  timezone = DEFAULT_PROP_FIRM_RESET_TIMEZONE,
  now = new Date(),
  apiDrawdown?: any
) {
  const accountSize = Number(account?.accountSize || 0)
  const phase = account?.currentPhase || {}
  const dailyDrawdownPercent = Number(phase.dailyDrawdownPercent || 0)
  const dailyLimit = accountSize * (dailyDrawdownPercent / 100)


  if (apiDrawdown?.isBreached && apiDrawdown?.dailyStartBalance) {
    const dailyStartBalance = Number(apiDrawdown.dailyStartBalance)
    const dailyDrawdownUsed = Math.max(0, dailyStartBalance - Number(apiDrawdown.currentEquity || 0))
    const dailyDrawdownRemaining = Math.max(0, dailyLimit - dailyDrawdownUsed)
    const dailyLossFloor = dailyStartBalance - dailyLimit
    return {
      dailyStartBalance,
      dailyDrawdownUsed,
      dailyDrawdownRemaining,
      dailyLossFloor,
      dailyLimit,
      isBreached: true,
      breachType: apiDrawdown.breachType,
      notes: apiDrawdown.notes,
    }
  }


  const breach = findFirstBreach(account, trades, timezone)
  if (breach) {
    return {
      dailyStartBalance: breach.dailyStartBalance,
      dailyDrawdownUsed: breach.dailyDrawdownUsed,
      dailyDrawdownRemaining: 0,
      dailyLossFloor: breach.dailyLossFloor,
      dailyLimit: breach.dailyLimit,
      isBreached: true,
      breachType: breach.breachType,
      notes: breach.notes,
    }
  }


  const todayKey = getPropFirmDateKey(now, timezone)
  let pnlBeforeToday = 0
  let todayPnl = 0

  for (const trade of trades) {
    const timestamp = getPropFirmTradeTimestamp(trade)
    const pnl = getPropFirmTradeNetPnl(trade)
    if (!timestamp) continue

    if (getPropFirmDateKey(timestamp, timezone) === todayKey) {
      todayPnl += pnl
    } else if (timestamp.getTime() < now.getTime()) {
      pnlBeforeToday += pnl
    }
  }

  const dailyStartBalance = accountSize + pnlBeforeToday
  const currentEquity = dailyStartBalance + todayPnl
  const dailyDrawdownUsed = Math.max(0, dailyStartBalance - currentEquity)
  const dailyDrawdownRemaining = Math.max(0, dailyLimit - dailyDrawdownUsed)
  const dailyLossFloor = dailyStartBalance - dailyLimit

  return {
    dailyStartBalance,
    dailyDrawdownUsed,
    dailyDrawdownRemaining,
    dailyLossFloor,
    dailyLimit,
    isBreached: false,
  }
}

export function formatPropFirmAxisMoney(value: number) {
  const amount = Math.round(Number(value) || 0)
  return `$${amount.toLocaleString('en-US')}`
}

