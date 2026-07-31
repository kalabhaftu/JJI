import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createRiskAlert } from '@/lib/services/notification-service'

export interface DrawdownCalculation {
  currentEquity: number
  dailyStartBalance: number
  highWaterMark: number
  dailyDrawdownUsed: number
  dailyDrawdownLimit: number
  dailyDrawdownRemaining: number
  dailyDrawdownPercent: number
  maxDrawdownUsed: number
  maxDrawdownLimit: number
  maxDrawdownRemaining: number
  maxDrawdownPercent: number
  isBreached: boolean
  breachType?: 'daily_drawdown' | 'max_drawdown'
  breachAmount?: number
  breachTime?: Date
}

export interface PhaseProgress {
  currentPnL: number
  profitTargetAmount: number
  profitTargetRemaining: number
  profitTargetPercent: number
  tradingDaysCompleted: number
  minTradingDaysRequired: number
  isEligibleForAdvancement: boolean
  canPassPhase: boolean
  daysRemaining?: number
}

export interface PhaseEvaluationResult {
  drawdown: DrawdownCalculation
  progress: PhaseProgress
  isFailed: boolean
  isPassed: boolean
  canAdvance: boolean
  nextAction: 'continue' | 'fail' | 'advance'
}

export class PhaseEvaluationEngine {

  private static log(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
    }
  }

  private static logError(message: string, error: any) {
  }

  static async evaluatePhase(
    masterAccountId: string,
    phaseAccountId: string
  ): Promise<PhaseEvaluationResult> {

    this.log(`Starting evaluation for masterAccountId: ${masterAccountId}, phaseAccountId: ${phaseAccountId}`)

    const phaseAccount = await db.query.PhaseAccount.findFirst({
      where: eq(schema.PhaseAccount.id, phaseAccountId),
      with: {
        MasterAccount: {
          with: {
            User: true
          }
        },
        Trade: {
          orderBy: (trade, { asc }) => [asc(trade.exitTime)]
        },
        DailyAnchor: {
          orderBy: (anchor, { desc }) => [desc(anchor.date)],
          limit: 1
        }
      }
    })

    if (!phaseAccount) {
      this.logError(`Phase account not found: ${phaseAccountId}`, null)
      throw new Error('Phase account not found')
    }

    this.log(`Phase account found`, {
      phaseNumber: phaseAccount.phaseNumber,
      status: phaseAccount.status,
      tradesCount: phaseAccount.Trade.length,
      accountSize: phaseAccount.MasterAccount.accountSize
    })

    const masterAccount = phaseAccount.MasterAccount
    const trades = phaseAccount.Trade
    // CRITICAL: Always use UTC for evaluation to ensure consistent 00:00 daily resets
    const timezone = 'UTC'

    // CRITICAL FIX: Calculate current metrics using NET P&L (after commission)
    // Commission is stored as NEGATIVE in DB (e.g., -4.5), so we ADD it to pnl
    const currentPnL = trades.reduce((sum: number, trade: any) => {
      const netPnl = (trade.pnl || 0) + (trade.commission || 0)
      return sum + netPnl
    }, 0)
    const currentEquity = masterAccount.accountSize + currentPnL

    this.log(`Current metrics calculated (NET of commission)`, {
      currentPnL,
      currentEquity,
      startingBalance: masterAccount.accountSize
    })

    // Calculate high-water mark (highest equity since phase start) using NET P&L
    let highWaterMark = masterAccount.accountSize
    let runningBalance = masterAccount.accountSize

    for (const trade of trades) {
      const netPnl = (trade.pnl || 0) + (trade.commission || 0)
      runningBalance += netPnl
      highWaterMark = Math.max(highWaterMark, runningBalance)
    }

    this.log(`High-water mark calculated: ${highWaterMark}`)

    // CRITICAL FIX: Check historical daily drawdowns for ALL days
    this.log(`[EVAL] Starting historical breach check for ${trades.length} trades`)
    this.log(`[EVAL] Account size: $${masterAccount.accountSize}, Daily DD%: ${phaseAccount.dailyDrawdownPercent}%, Limit: $${(masterAccount.accountSize * phaseAccount.dailyDrawdownPercent / 100).toFixed(2)}`)

    const historicalBreachCheck = await this.checkHistoricalDailyDrawdowns(
      phaseAccount,
      trades,
      masterAccount.accountSize,
      timezone
    )

    if (historicalBreachCheck.isBreached) {
      try {
        await db.insert(schema.BreachRecord).values({
          id: crypto.randomUUID(),
          phaseAccountId,
          breachType: 'daily_drawdown',
          breachAmount: historicalBreachCheck.breachAmount || 0,
          currentEquity: historicalBreachCheck.dayEndBalance,
          accountSize: masterAccount.accountSize,
          dailyStartBalance: historicalBreachCheck.dayStartBalance,
          notes: `Daily drawdown breach on ${historicalBreachCheck.breachDate}. Lost $${historicalBreachCheck.dayLoss.toFixed(2)} on this day, exceeding the $${historicalBreachCheck.dailyLimit.toFixed(2)} daily limit by $${(historicalBreachCheck.breachAmount || 0).toFixed(2)}.`,
          breachTime: historicalBreachCheck.breachTime,
          updatedAt: new Date()
        })
        this.log(`[EVAL] BreachRecord created for daily drawdown breach`)
      } catch (e) {
        this.logError('Failed to create BreachRecord', e)
      }

      // Send breach notification
      try {
        const userId = masterAccount.userId
        await createRiskAlert(
          userId,
          phaseAccountId,
          'daily_loss',
          100, // breach is 100%+
          {
            accountName: masterAccount.accountName,
            currentBalance: historicalBreachCheck.dayEndBalance,
            limit: historicalBreachCheck.dailyLimit,
            used: historicalBreachCheck.dayLoss
          }
        )
      } catch (notificationError) {
        this.logError('Failed to send breach notification', notificationError)
      }

      return {
        drawdown: {
          currentEquity,
          dailyStartBalance: historicalBreachCheck.dayStartBalance,
          highWaterMark,
          dailyDrawdownUsed: historicalBreachCheck.dayLoss,
          dailyDrawdownLimit: historicalBreachCheck.dailyLimit,
          dailyDrawdownRemaining: 0,
          dailyDrawdownPercent: (historicalBreachCheck.dayLoss / historicalBreachCheck.dayStartBalance) * 100,
          maxDrawdownUsed: masterAccount.accountSize - currentEquity,
          maxDrawdownLimit: masterAccount.accountSize * (phaseAccount.maxDrawdownPercent / 100),
          maxDrawdownRemaining: 0,
          maxDrawdownPercent: ((masterAccount.accountSize - currentEquity) / masterAccount.accountSize) * 100,
          isBreached: true,
          breachType: 'daily_drawdown',
          ...(historicalBreachCheck.breachAmount !== undefined && { breachAmount: historicalBreachCheck.breachAmount }),
          ...(historicalBreachCheck.breachTime !== undefined && { breachTime: historicalBreachCheck.breachTime })
        },
        progress: this.calculateProgress(phaseAccount, currentPnL, trades),
        isFailed: true,
        isPassed: false,
        canAdvance: false,
        nextAction: 'fail'
      }
    }

    // CRITICAL FIX: Check historical MAX DRAWDOWN for ALL trades chronologically
    // This catches breaches where the balance dipped below the limit but recovered
    const historicalMaxDDCheck = this.checkHistoricalMaxDrawdown(
      trades,
      masterAccount.accountSize,
      phaseAccount.maxDrawdownPercent,
      phaseAccount.maxDrawdownType || ''
    )

    if (historicalMaxDDCheck.isBreached) {
      this.log(`[EVAL] Historical MAX DRAWDOWN breach detected`, {
        lowestBalance: historicalMaxDDCheck.lowestBalance,
        minAllowed: historicalMaxDDCheck.minAllowedBalance,
        breachAmount: historicalMaxDDCheck.breachAmount
      })

      try {
        await db.insert(schema.BreachRecord).values({
          id: crypto.randomUUID(),
          phaseAccountId,
          breachType: 'max_drawdown',
          breachAmount: historicalMaxDDCheck.breachAmount || 0,
          currentEquity: historicalMaxDDCheck.lowestBalance,
          accountSize: masterAccount.accountSize,
          highWaterMark,
          notes: `Historical max drawdown breach detected. Balance dipped to $${historicalMaxDDCheck.lowestBalance.toFixed(2)}, below the $${historicalMaxDDCheck.minAllowedBalance.toFixed(2)} limit by $${(historicalMaxDDCheck.breachAmount || 0).toFixed(2)}.`,
          breachTime: historicalMaxDDCheck.breachTime,
          updatedAt: new Date()
        })
        this.log(`[EVAL] BreachRecord created for max drawdown breach`)
      } catch (e) {
        this.logError('Failed to create BreachRecord', e)
      }

      // Send breach notification
      try {
        const userId = masterAccount.userId
        await createRiskAlert(
          userId,
          phaseAccountId,
          'max_drawdown',
          100, // breach is 100%+
          {
            accountName: masterAccount.accountName,
            currentBalance: historicalMaxDDCheck.lowestBalance,
            limit: historicalMaxDDCheck.maxDrawdownLimit,
            used: historicalMaxDDCheck.maxDrawdownUsed
          }
        )
      } catch (notificationError) {
        this.logError('Failed to send breach notification', notificationError)
      }

      return {
        drawdown: {
          currentEquity,
          dailyStartBalance: masterAccount.accountSize,
          highWaterMark,
          dailyDrawdownUsed: 0,
          dailyDrawdownLimit: masterAccount.accountSize * (phaseAccount.dailyDrawdownPercent / 100),
          dailyDrawdownRemaining: masterAccount.accountSize * (phaseAccount.dailyDrawdownPercent / 100),
          dailyDrawdownPercent: 0,
          maxDrawdownUsed: historicalMaxDDCheck.maxDrawdownUsed,
          maxDrawdownLimit: historicalMaxDDCheck.maxDrawdownLimit,
          maxDrawdownRemaining: 0,
          maxDrawdownPercent: (historicalMaxDDCheck.maxDrawdownUsed / masterAccount.accountSize) * 100,
          isBreached: true,
          breachType: 'max_drawdown',
          ...(historicalMaxDDCheck.breachAmount !== undefined && { breachAmount: historicalMaxDDCheck.breachAmount }),
          ...(historicalMaxDDCheck.breachTime !== undefined && { breachTime: historicalMaxDDCheck.breachTime })
        },
        progress: this.calculateProgress(phaseAccount, currentPnL, trades),
        isFailed: true,
        isPassed: false,
        canAdvance: false,
        nextAction: 'fail'
      }
    }

    const dailyStartBalance = await this.getDailyStartBalance(
      phaseAccountId,
      timezone,
      masterAccount.accountSize
    )

    this.log(`Daily start balance: ${dailyStartBalance}`)

    const drawdown = this.calculateDrawdown(
      phaseAccount,
      currentEquity,
      dailyStartBalance,
      highWaterMark,
      masterAccount.accountSize
    )

    this.log(`Drawdown calculation completed`, {
      isBreached: drawdown.isBreached,
      breachType: drawdown.breachType,
      dailyDrawdownUsed: drawdown.dailyDrawdownUsed,
      dailyDrawdownLimit: drawdown.dailyDrawdownLimit,
      maxDrawdownUsed: drawdown.maxDrawdownUsed,
      maxDrawdownLimit: drawdown.maxDrawdownLimit
    })

    const progress = this.calculateProgress(
      phaseAccount,
      currentPnL,
      trades
    )

    this.log(`Progress calculation completed`, {
      canPassPhase: progress.canPassPhase,
      isEligibleForAdvancement: progress.isEligibleForAdvancement,
      profitTargetPercent: progress.profitTargetPercent,
      tradingDaysCompleted: progress.tradingDaysCompleted,
      minTradingDaysRequired: progress.minTradingDaysRequired
    })

    try {
      const userId = masterAccount.userId

      if (drawdown.dailyDrawdownPercent >= 80 && drawdown.dailyDrawdownPercent < 100 && !drawdown.isBreached) {
        await createRiskAlert(
          userId,
          phaseAccountId,
          'daily_loss',
          drawdown.dailyDrawdownPercent,
          {
            accountName: masterAccount.accountName,
            currentBalance: currentEquity,
            limit: drawdown.dailyDrawdownLimit,
            used: drawdown.dailyDrawdownUsed
          }
        )
        this.log(`Risk alert sent: Daily loss at ${drawdown.dailyDrawdownPercent.toFixed(1)}%`)
      }

      if (drawdown.maxDrawdownPercent >= 80 && drawdown.maxDrawdownPercent < 100 && !drawdown.isBreached) {
        await createRiskAlert(
          userId,
          phaseAccountId,
          'max_drawdown',
          drawdown.maxDrawdownPercent,
          {
            accountName: masterAccount.accountName,
            currentBalance: currentEquity,
            limit: drawdown.maxDrawdownLimit,
            used: drawdown.maxDrawdownUsed
          }
        )
        this.log(`Risk alert sent: Max drawdown at ${drawdown.maxDrawdownPercent.toFixed(1)}%`)
      }
    } catch (notificationError) {
      // Don't fail evaluation if notification fails
      this.logError('Failed to send risk notification', notificationError)
    }

    // If account is breached, it CANNOT pass regardless of profit target
    if (drawdown.isBreached) {
      this.log(`FAILURE-FIRST: Account breached - ${drawdown.breachType}`, {
        breachAmount: drawdown.breachAmount,
        profitTargetMet: progress.profitTargetPercent >= 100
      })

      // Send breach notification
      try {
        const userId = masterAccount.userId
        await createRiskAlert(
          userId,
          phaseAccountId,
          drawdown.breachType === 'daily_drawdown' ? 'daily_loss' : 'max_drawdown',
          100, // breach is 100%+
          {
            accountName: masterAccount.accountName,
            currentBalance: currentEquity,
            limit: drawdown.breachType === 'daily_drawdown' ? drawdown.dailyDrawdownLimit : drawdown.maxDrawdownLimit,
            used: drawdown.breachType === 'daily_drawdown' ? drawdown.dailyDrawdownUsed : drawdown.maxDrawdownUsed
          }
        )
        this.log(`Risk alert sent: Account Breached`)
      } catch (notificationError) {
        this.logError('Failed to send breach notification', notificationError)
      }

      return {
        drawdown,
        progress,
        isFailed: true,
        isPassed: false,
        canAdvance: false,
        nextAction: 'fail'
      }
    }

    const canAdvance = progress.canPassPhase && progress.isEligibleForAdvancement

    this.log(`Final evaluation result`, {
      canAdvance,
      nextAction: canAdvance ? 'advance' : 'continue',
      isFailed: false,
      isPassed: canAdvance
    })

    return {
      drawdown,
      progress,
      isFailed: false,
      isPassed: canAdvance,
      canAdvance,
      nextAction: canAdvance ? 'advance' : 'continue'
    }
  }

  private static async checkHistoricalDailyDrawdowns(
    phaseAccount: any,
    trades: any[],
    accountSize: number,
    timezone: string
  ): Promise<{
    isBreached: boolean
    breachDate?: string
    breachTime?: Date
    dayStartBalance: number
    dayEndBalance: number
    dayLoss: number
    dailyLimit: number
    breachAmount?: number
  }> {

    if (trades.length === 0) {
      return {
        isBreached: false,
        dayStartBalance: accountSize,
        dayEndBalance: accountSize,
        dayLoss: 0,
        dailyLimit: accountSize * (phaseAccount.dailyDrawdownPercent / 100)
      }
    }

    const dailyDrawdownLimit = accountSize * (phaseAccount.dailyDrawdownPercent / 100)

    const tradesByDay = new Map<string, any[]>()

    this.log(`[EVAL] Grouping ${trades.length} trades by day...`)
    for (const trade of trades) {
      const exitDate = trade.exitTime || trade.createdAt
      const dateStr = this.getDateInTimezone(new Date(exitDate), timezone)

      // this.log(`[EVAL] Trade: ${trade.instrument} PnL=$${trade.pnl} exitDate=${exitDate} -> day=${dateStr}`)

      if (!tradesByDay.has(dateStr)) {
        tradesByDay.set(dateStr, [])
      }
      tradesByDay.get(dateStr)!.push(trade)
    }

    this.log(`[EVAL] Grouped into ${tradesByDay.size} days: ${Array.from(tradesByDay.keys()).join(', ')}`)
    this.log(`[EVAL] Daily limit: $${dailyDrawdownLimit.toFixed(2)} (${phaseAccount.dailyDrawdownPercent}%)`)

    this.log(`Checking ${tradesByDay.size} days for historical breaches`, {
      dailyDrawdownLimit,
      dailyDrawdownPercent: phaseAccount.dailyDrawdownPercent
    })

    const sortedDays = Array.from(tradesByDay.keys()).sort()

    let runningBalance = accountSize

    for (const dayStr of sortedDays) {
      const dayTrades = tradesByDay.get(dayStr)!
      const dayStartBalance = runningBalance

      let dayPnL = 0
      for (const trade of dayTrades) {
        // CRITICAL FIX: Use net P&L for daily drawdown calculations
        // Commission is stored as NEGATIVE in DB, so we ADD it
        const netPnl = (trade.pnl || 0) + (trade.commission || 0)
        dayPnL += netPnl
      }

      const dayEndBalance = dayStartBalance + dayPnL
      const dayLoss = dayPnL < 0 ? Math.abs(dayPnL) : 0

      this.log(`[EVAL] Day: ${dayStr}`, {
        dayStartBalance: `$${dayStartBalance.toFixed(2)}`,
        dayPnL: `$${dayPnL.toFixed(2)}`,
        dayEndBalance: `$${dayEndBalance.toFixed(2)}`,
        dayLoss: `$${dayLoss.toFixed(2)}`,
        dailyLimit: `$${dailyDrawdownLimit.toFixed(2)}`,
        tradesCount: dayTrades.length,
        isBreached: dayLoss > dailyDrawdownLimit
      })

      // Check if this day breached the daily drawdown limit
      if (dayLoss > dailyDrawdownLimit) {
        const breachAmount = dayLoss - dailyDrawdownLimit

        this.log(`[EVAL] Historical daily drawdown breach detected`, {
          breachAmount,
          tradesOnDay: dayTrades.length
        })

        return {
          isBreached: true,
          breachDate: dayStr,
          breachTime: new Date(dayStr),
          dayStartBalance,
          dayEndBalance,
          dayLoss,
          dailyLimit: dailyDrawdownLimit,
          breachAmount
        }
      }

      runningBalance = dayEndBalance
    }

    return {
      isBreached: false,
      dayStartBalance: accountSize,
      dayEndBalance: runningBalance,
      dayLoss: 0,
      dailyLimit: dailyDrawdownLimit
    }
  }

  // For STATIC drawdown: balance below (accountSize - maxDrawdownLimit).
  // For TRAILING drawdown: balance below (highWaterMark - maxDrawdownLimit).
  private static checkHistoricalMaxDrawdown(
    trades: any[],
    accountSize: number,
    maxDrawdownPercent: number,
    maxDrawdownType: string
  ): {
    isBreached: boolean
    lowestBalance: number
    minAllowedBalance: number
    maxDrawdownUsed: number
    maxDrawdownLimit: number
    breachAmount?: number
    breachTime?: Date
  } {

    if (trades.length === 0) {
      const maxDrawdownLimit = accountSize * (maxDrawdownPercent / 100)
      return {
        isBreached: false,
        lowestBalance: accountSize,
        minAllowedBalance: accountSize - maxDrawdownLimit,
        maxDrawdownUsed: 0,
        maxDrawdownLimit
      }
    }

    let runningBalance = accountSize
    let lowestBalance = accountSize
    let highWaterMark = accountSize
    let breachTime: Date | undefined = undefined

    const sortedTrades = [...trades].sort((a, b) => {
      const aTime = a.exitTime ? new Date(a.exitTime).getTime() : 0
      const bTime = b.exitTime ? new Date(b.exitTime).getTime() : 0
      return aTime - bTime
    })

    for (const trade of sortedTrades) {
      const netPnl = (trade.pnl || 0) + (trade.commission || 0)
      runningBalance += netPnl

      if (runningBalance > highWaterMark) {
        highWaterMark = runningBalance
      }

      if (runningBalance < lowestBalance) {
        lowestBalance = runningBalance
        breachTime = trade.exitTime ? new Date(trade.exitTime) : new Date(trade.createdAt)
      }
    }

    let drawdownBase: number
    if (maxDrawdownType === 'trailing') {
      drawdownBase = highWaterMark
    } else {
      drawdownBase = accountSize
    }

    const maxDrawdownLimit = drawdownBase * (maxDrawdownPercent / 100)
    const minAllowedBalance = drawdownBase - maxDrawdownLimit
    const maxDrawdownUsed = accountSize - lowestBalance

    if (lowestBalance < minAllowedBalance) {
      const breachAmount = minAllowedBalance - lowestBalance

      this.log(`[HIST_MAX_DD] Breach detected`, {
        lowestBalance,
        minAllowedBalance,
        breachAmount,
        drawdownBase,
        maxDrawdownType
      })

      return {
        isBreached: true,
        lowestBalance,
        minAllowedBalance,
        maxDrawdownUsed,
        maxDrawdownLimit,
        ...(breachAmount !== undefined && { breachAmount }),
        ...(breachTime !== undefined && { breachTime })
      }
    }

    return {
      isBreached: false,
      lowestBalance,
      minAllowedBalance,
      maxDrawdownUsed,
      maxDrawdownLimit
    }
  }

  private static calculateDrawdown(
    phaseAccount: any,
    currentEquity: number,
    dailyStartBalance: number,
    highWaterMark: number,
    accountSize: number
  ): DrawdownCalculation {

    const dailyDrawdownLimit = accountSize * (phaseAccount.dailyDrawdownPercent / 100)
    const dailyDrawdownUsed = Math.max(0, dailyStartBalance - currentEquity)
    const dailyDrawdownRemaining = Math.max(0, dailyDrawdownLimit - dailyDrawdownUsed)
    const dailyDrawdownPercent = dailyStartBalance > 0 ? (dailyDrawdownUsed / dailyStartBalance) * 100 : 0

    let maxDrawdownBase: number
    let maxDrawdownLimit: number

    if (phaseAccount.maxDrawdownType === 'trailing') {
      // Trailing: Use high-water mark as base
      maxDrawdownBase = highWaterMark
      maxDrawdownLimit = highWaterMark * (phaseAccount.maxDrawdownPercent / 100)
    } else {
      // Static: Use starting balance as base
      maxDrawdownBase = accountSize
      maxDrawdownLimit = accountSize * (phaseAccount.maxDrawdownPercent / 100)
    }

    const maxDrawdownUsed = Math.max(0, maxDrawdownBase - currentEquity)
    const maxDrawdownRemaining = Math.max(0, maxDrawdownLimit - maxDrawdownUsed)
    const maxDrawdownPercent = maxDrawdownBase > 0 ? (maxDrawdownUsed / maxDrawdownBase) * 100 : 0

    // FAILURE-FIRST PRIORITY: Check breaches
    let isBreached = false
    let breachType: 'daily_drawdown' | 'max_drawdown' | undefined
    let breachAmount: number | undefined

    // Check daily drawdown FIRST
    if (dailyDrawdownUsed > dailyDrawdownLimit) {
      isBreached = true
      breachType = 'daily_drawdown'
      breachAmount = dailyDrawdownUsed - dailyDrawdownLimit
    }
    // Only check max drawdown if daily drawdown hasn't been breached
    else if (maxDrawdownUsed > maxDrawdownLimit) {
      isBreached = true
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
      isBreached,
      ...(breachType !== undefined && { breachType }),
      ...(breachAmount !== undefined && { breachAmount }),
      ...(isBreached && { breachTime: new Date() })
    }
  }

  private static calculateProgress(
    phaseAccount: any,
    currentPnL: number,
    trades: any[]
  ): PhaseProgress {

    // CRITICAL FIX: Prisma relation is MasterAccount (capital M), not masterAccount
    const accountSize = phaseAccount.MasterAccount?.accountSize || phaseAccount.masterAccount?.accountSize || 0

    if (!accountSize || accountSize === 0) {
    }

    const profitTargetAmount = accountSize * (phaseAccount.profitTargetPercent / 100)
    const profitTargetRemaining = Math.max(0, profitTargetAmount - currentPnL)
    const profitTargetPercent = profitTargetAmount > 0 ? (currentPnL / profitTargetAmount) * 100 : 100

    this.log(`[PROGRESS] Calculating progress`, {
      accountSize,
      targetProfitTargetPercent: phaseAccount.profitTargetPercent,
      profitTargetAmount,
      currentPnL,
      currentProgressPercent: profitTargetPercent.toFixed(2) + '%'
    })

    const tradingDates = new Set(
      trades.map(trade => {
        const date = trade.exitTime || trade.createdAt
        return new Date(date).toDateString()
      })
    )
    const tradingDaysCompleted = tradingDates.size
    const minTradingDaysRequired = phaseAccount.minTradingDays || 0

    const isProfitTargetMet = phaseAccount.profitTargetPercent === 0 || currentPnL >= profitTargetAmount

    const areMinTradingDaysMet = tradingDaysCompleted >= minTradingDaysRequired

    let isWithinTimeLimit = true
    let daysRemaining: number | undefined

    if (phaseAccount.timeLimitDays) {
      const phaseStartDate = new Date(phaseAccount.startDate)
      const currentDate = new Date()
      const daysSinceStart = Math.floor((currentDate.getTime() - phaseStartDate.getTime()) / (1000 * 60 * 60 * 24))

      daysRemaining = phaseAccount.timeLimitDays - daysSinceStart
      isWithinTimeLimit = daysSinceStart <= phaseAccount.timeLimitDays
    }

    const canPassPhase = isProfitTargetMet && areMinTradingDaysMet && isWithinTimeLimit
    const isEligibleForAdvancement = canPassPhase

    this.log(`[PROGRESS] Results`, {
      isProfitTargetMet,
      areMinTradingDaysMet: `${tradingDaysCompleted}/${minTradingDaysRequired}`,
      isWithinTimeLimit,
      canPassPhase
    })

    return {
      currentPnL,
      profitTargetAmount,
      profitTargetRemaining,
      profitTargetPercent,
      tradingDaysCompleted,
      minTradingDaysRequired,
      isEligibleForAdvancement,
      canPassPhase,
      ...(daysRemaining !== undefined && { daysRemaining })
    }
  }

  private static async getDailyStartBalance(
    phaseAccountId: string,
    timezone: string,
    fallbackBalance: number
  ): Promise<number> {

    const today = this.getDateInTimezone(new Date(), timezone)
    const todayDate = new Date(today)

    const todayAnchor = await db.query.DailyAnchor.findFirst({
      where: and(
        eq(schema.DailyAnchor.phaseAccountId, phaseAccountId),
        eq(schema.DailyAnchor.date, todayDate)
      )
    })

    if (todayAnchor) {
      return todayAnchor.anchorEquity
    }

    try {
      const phaseAccount = await db.query.PhaseAccount.findFirst({
        where: eq(schema.PhaseAccount.id, phaseAccountId),
        with: {
          MasterAccount: true,
          Trade: {
            where: (table, { lt, isNull, or, and }) => or(
              lt(table.exitTime, todayDate),
              and(isNull(table.exitTime), lt(table.createdAt, todayDate))
            ),
            orderBy: (trade, { asc }) => [asc(trade.exitTime)]
          }
        }
      })

      if (!phaseAccount) {
        return fallbackBalance
      }

      const tradesPnL = phaseAccount.Trade.reduce((sum: number, trade: any) => {
        const netPnl = (trade.pnl || 0) + (trade.commission || 0)
        return sum + netPnl
      }, 0)
      const anchorEquity = phaseAccount.MasterAccount.accountSize + tradesPnL

      const [newAnchor] = await db.insert(schema.DailyAnchor).values({
        id: crypto.randomUUID(),
        phaseAccountId,
        date: todayDate,
        anchorEquity
      }).returning()

      return newAnchor ? newAnchor.anchorEquity : fallbackBalance

    } catch (error) {

      return fallbackBalance
    }
  }

  private static getDateInTimezone(date: Date, timezone: string): string {
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }

      const parts = new Intl.DateTimeFormat('en-CA', options).format(date)
      return parts // Returns YYYY-MM-DD format
    } catch (error) {
      return date.toISOString().split('T')[0] as string
    }
  }
}
