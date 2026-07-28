import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { TRADE_COUNT_SELECT, buildGroupedTradeCountSummary } from '@/lib/trade-counts'
import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { getRuntimeBreakEvenThreshold } from '@/server/user-settings'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'
import { withCache } from '@/lib/cache/helpers'
import { CacheKeys, CacheTTL } from '@/lib/cache/keys'
import {
  buildPropFirmAccountExtremes,
  buildPropFirmDailyDrawdown,
  buildPropFirmGrowth,
  buildPropFirmTodayStats,
  getPropFirmTradeTimestamp,
} from '@/lib/prop-firm/widget-metrics'
import { eq, and, inArray, desc, asc, exists } from 'drizzle-orm'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Helper function to determine if a phase number represents the funded stage
 * based on the evaluation type.
 */
function isFundedPhase(evaluationType: string, phaseNumber: number): boolean {
  return isFundedPhaseForEvaluation(evaluationType, phaseNumber)
}

// Only user-editable master-account fields are accepted.
const UpdateMasterAccountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required').optional(),
  status: z.enum(['active', 'funded', 'failed']).optional(),
  isArchived: z.boolean().optional()
})

function normalizeTimeZone(value: string | null) {
  if (!value) return 'UTC'

  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return value
  } catch (error) {
    Sentry.captureException(error, { extra: { route: '/api/v1/prop-firm/accounts/[id]', phase: 'timezone-validation' } })
    return 'UTC'
  }
}

function getLatestTradeTimestamp(trades: any[]) {
  let latest: Date | null = null

  for (const trade of trades) {
    const timestamp = getPropFirmTradeTimestamp(trade)
    if (!timestamp) continue
    if (!latest || timestamp.getTime() > latest.getTime()) {
      latest = timestamp
    }
  }

  return latest
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const internalUserId = identity.internalUserId

    const { id: masterAccountId } = await params
    const { searchParams } = new URL(request.url)
    const resetTimezone = normalizeTimeZone(searchParams.get('resetTimezone'))
    // ID is pure masterAccountId (UUID), not composite

    // PERFORMANCE OPTIMIZATION: Use parallel queries and database aggregations
    const [masterAccount, phases, allPhaseTrades, breakEvenThreshold] = await Promise.all([
      // 1. Get master account basic info (no nested relations)
      db.query.MasterAccount.findFirst({
        where: (table, { eq, and }) => and(
          eq(table.id, masterAccountId),
          eq(table.userId, internalUserId)
        ),
        columns: {
          id: true,
          accountName: true,
          propFirmName: true,
          accountSize: true,
          evaluationType: true,
          currentPhase: true,
          status: true,
          createdAt: true,
          userId: true
        }
      }),

      // 2. Get phases with 10 most recent trades and breach records using nested include
      db.query.PhaseAccount.findMany({
        where: (table, { eq }) => eq(table.masterAccountId, masterAccountId),
        with: {
          Trade: {
            columns: {
              id: true,
              instrument: true,
              symbol: true,
              pnl: true,
              exitTime: true,
              entryTime: true,
            },
            orderBy: (table, { desc }) => [desc(table.exitTime)],
            limit: 10
          },
          BreachRecord: {
            orderBy: (table, { asc }) => [asc(table.breachTime)],
            limit: 1
          }
        },
        orderBy: (table, { asc }) => [asc(table.phaseNumber)]
      }),

      // 3. Get all phase trades once, then build grouped execution stats consistently
      db.query.Trade.findMany({
        where: (table, { exists, eq }) => exists(
          db.select({ id: schema.PhaseAccount.id })
            .from(schema.PhaseAccount)
            .where(
              and(
                eq(schema.PhaseAccount.id, table.phaseAccountId),
                eq(schema.PhaseAccount.masterAccountId, masterAccountId)
              )
            )
        ),
        columns: TRADE_COUNT_SELECT as any,
        orderBy: (table, { asc }) => [asc(table.exitTime)]
      }),
      getRuntimeBreakEvenThreshold(internalUserId)
    ])

    if (!masterAccount) {
      return NextResponse.json(
        { success: false, error: 'Master account not found' },
        { status: 404 }
      )
    }
    // Get the current active phase
    const currentPhase = phases.find(
      (phase: typeof phases[number]) => phase.phaseNumber === masterAccount.currentPhase
    )

    // NOTE: Evaluation is now done in the background after trade import
    // This keeps the GET request fast and responsive

    const groupedCounts = buildGroupedTradeCountSummary(allPhaseTrades as any)
    const totalTrades = groupedCounts.groupedTradeCount
    const totalPnL = groupedCounts.groupedTrades.reduce(
      (sum: number, trade: any) => sum + Number(trade.pnl || 0),
      0
    )

    const currentPhaseGroupedTrades = groupedCounts.groupedTrades.filter(
      (trade: any) => trade.phaseAccountId === currentPhase?.id
    )

    // CRITICAL FIX: Use canonical net P&L (`trade.pnl`) and exclude break-even trades
    const winningTrades = groupedCounts.groupedTrades.filter(
      (trade: { pnl: number }) => {
        return classifyOutcome(getTradeNetPnl(trade), breakEvenThreshold) === 'win'
      }
    ).length
    const losingTrades = groupedCounts.groupedTrades.filter(
      (trade: { pnl: number }) => {
        return classifyOutcome(getTradeNetPnl(trade), breakEvenThreshold) === 'loss'
      }
    ).length
    const tradableCount = winningTrades + losingTrades
    const winRate = tradableCount > 0 ? (winningTrades / tradableCount) * 100 : 0

    // Calculate current phase statistics - PHASE SPECIFIC!
    const currentPhaseTradeCount = currentPhase
      ? (groupedCounts.groupedCountByPhaseAccountId.get(currentPhase.id) || 0)
      : 0
    const currentPhaseGrossPnL = currentPhaseGroupedTrades.reduce(
      (sum: number, trade: any) => sum + Number(trade.pnl || 0),
      0
    )
    const currentPhaseNetPnL = currentPhaseGroupedTrades.reduce(
      (sum: number, trade: any) => sum + Number(trade.pnl || 0) + Number(trade.commission || 0),
      0
    )

    // Determine next action based on phase status
    let nextAction = 'continue_trading'
    if (!currentPhase?.phaseId) {
      nextAction = 'set_phase_id'
    } else if (currentPhase.status === 'passed') {
      nextAction = 'ready_to_advance'
    } else if (currentPhase.status === 'failed') {
      nextAction = 'failed'
    }

    // Calculate drawdown data for the hook
    const drawdownData = {
      dailyDrawdownRemaining: 0,
      maxDrawdownRemaining: 0,
      dailyStartBalance: 0,
      highestEquity: 0,
      currentEquity: 0,
      isBreached: false,
      breachType: undefined as 'daily_drawdown' | 'max_drawdown' | undefined
    }

    // FIXED: Calculate current balance and equity from CURRENT PHASE trades only
    const currentBalance = masterAccount.accountSize + currentPhaseNetPnL
    const currentEquity = currentBalance

    // Calculate drawdown based on current phase rules
    if (currentPhase) {
      // Calculate highest equity (high-water mark) - track peak balance
      // IMPORTANT: Use only CURRENT PHASE trades, not all phases!
      // Use grouped trades for accurate high-water mark calculation
      let highWaterMark = masterAccount.accountSize
      let runningBalance = masterAccount.accountSize

      // Calculate high-water mark from CURRENT PHASE grouped trades in order
      // Grouped trades ensure partial closes are counted as single trades
      for (const trade of currentPhaseGroupedTrades as Array<{ pnl: number }>) {
        runningBalance += Number(trade.pnl || 0)
        highWaterMark = Math.max(highWaterMark, runningBalance)
      }

      drawdownData.highestEquity = highWaterMark
      drawdownData.currentEquity = currentEquity

      // Get daily start balance from daily anchor (fallback to account size)
      const todayAnchor = await db.query.DailyAnchor.findFirst({
        where: (table, { eq, and, gte }) => and(
          eq(table.phaseAccountId, currentPhase.id),
          gte(table.date, new Date(new Date().setHours(0, 0, 0, 0)))
        ),
        orderBy: (table, { desc }) => [desc(table.date)]
      })

      const dailyStartBalance = todayAnchor?.anchorEquity || masterAccount.accountSize
      drawdownData.dailyStartBalance = dailyStartBalance

      // Daily drawdown calculation (from daily start balance)
      const dailyDrawdownLimit = currentPhase.dailyDrawdownPercent > 0
        ? (masterAccount.accountSize * currentPhase.dailyDrawdownPercent) / 100
        : 0
      const dailyDrawdownUsed = Math.max(0, dailyStartBalance - currentEquity)
      drawdownData.dailyDrawdownRemaining = Math.max(0, dailyDrawdownLimit - dailyDrawdownUsed)

      // Max drawdown calculation (static vs trailing)
      let maxDrawdownBase: number
      let maxDrawdownLimit: number

      if (currentPhase.maxDrawdownType === 'trailing') {
        // Trailing: Base on high-water mark
        maxDrawdownBase = highWaterMark
        maxDrawdownLimit = highWaterMark * (currentPhase.maxDrawdownPercent / 100)
      } else {
        // Static: Base on starting balance
        maxDrawdownBase = masterAccount.accountSize
        maxDrawdownLimit = masterAccount.accountSize * (currentPhase.maxDrawdownPercent / 100)
      }

      const maxDrawdownUsed = Math.max(0, maxDrawdownBase - currentEquity)
      drawdownData.maxDrawdownRemaining = Math.max(0, maxDrawdownLimit - maxDrawdownUsed)

      // FAILURE-FIRST: Check breaches (daily first, then max)
      if (dailyDrawdownUsed > dailyDrawdownLimit) {
        drawdownData.isBreached = true
        drawdownData.breachType = 'daily_drawdown'
      } else if (maxDrawdownUsed > maxDrawdownLimit) {
        drawdownData.isBreached = true
        drawdownData.breachType = 'max_drawdown'
      }

      // If there is an actual BreachRecord in the database, override calculations to freeze details
      const firstBreach = (currentPhase as any).BreachRecord?.[0]
      if (firstBreach) {
        drawdownData.isBreached = true
        drawdownData.breachType = firstBreach.breachType
        drawdownData.dailyStartBalance = firstBreach.dailyStartBalance || masterAccount.accountSize
        drawdownData.highestEquity = firstBreach.highWaterMark || masterAccount.accountSize
        drawdownData.currentEquity = firstBreach.currentEquity
        drawdownData.dailyDrawdownRemaining = 0
        drawdownData.maxDrawdownRemaining = 0
        ;(drawdownData as any).notes = firstBreach.notes
        ;(drawdownData as any).breachTime = firstBreach.breachTime
        ;(drawdownData as any).breachAmount = firstBreach.breachAmount
      }
    }

    const phaseMetricsById = new Map<string, {
      tradeCount: number
      totalPnL: number
      wins: number
      losses: number
      breakEvenTrades: number
      winRate: number
      profitProgress: number
    }>()

    for (const phase of phases as Array<typeof phases[number]>) {
      const phaseTrades = groupedCounts.groupedTrades.filter((trade: any) => trade.phaseAccountId === phase.id)
      let totalPnLForPhase = 0
      let phaseWins = 0
      let phaseLosses = 0
      let phaseBreakEvenTrades = 0

      for (const trade of phaseTrades as Array<{ pnl: number }>) {
        const netPnl = getTradeNetPnl(trade)
        totalPnLForPhase += netPnl

        const outcome = classifyOutcome(netPnl, breakEvenThreshold)
        if (outcome === 'win') phaseWins += 1
        else if (outcome === 'loss') phaseLosses += 1
        else phaseBreakEvenTrades += 1
      }

      const phaseTradableTrades = phaseWins + phaseLosses
      phaseMetricsById.set(phase.id, {
        tradeCount: phaseTrades.length,
        totalPnL: totalPnLForPhase,
        wins: phaseWins,
        losses: phaseLosses,
        breakEvenTrades: phaseBreakEvenTrades,
        winRate: phaseTradableTrades > 0 ? (phaseWins / phaseTradableTrades) * 100 : 0,
        profitProgress: phase.profitTargetPercent > 0
          ? Math.min((totalPnLForPhase / ((phase.profitTargetPercent / 100) * masterAccount.accountSize)) * 100, 100)
          : 0,
      })
    }

    // Format account data as expected by the hook
    const accountData = {
      id: masterAccount.id,
      accountName: masterAccount.accountName,
      propFirmName: masterAccount.propFirmName,
      accountSize: masterAccount.accountSize,
      evaluationType: masterAccount.evaluationType,
      currentPhase: currentPhase || null,
      status: masterAccount.status,
      phases: phases.map((phase: any) => {
        const phaseMetrics = phaseMetricsById.get(phase.id)
        return {
          id: phase.id,
          phaseNumber: phase.phaseNumber,
          phaseId: phase.phaseId,
          status: phase.status,
          profitTargetPercent: phase.profitTargetPercent,
          dailyDrawdownPercent: phase.dailyDrawdownPercent,
          maxDrawdownPercent: phase.maxDrawdownPercent,
          maxDrawdownType: phase.maxDrawdownType,
          minTradingDays: phase.minTradingDays,
          timeLimitDays: phase.timeLimitDays,
          consistencyRulePercent: phase.consistencyRulePercent,
          profitSplitPercent: phase.profitSplitPercent,
          payoutCycleDays: phase.payoutCycleDays,
          startDate: phase.startDate.toISOString(),
          endDate: phase.endDate?.toISOString() || null,
          trades: phase.Trade || [],
          tradeCount: phaseMetrics?.tradeCount ?? 0,
          totalPnL: phaseMetrics?.totalPnL ?? 0,
          wins: phaseMetrics?.wins ?? 0,
          losses: phaseMetrics?.losses ?? 0,
          breakEvenTrades: phaseMetrics?.breakEvenTrades ?? 0,
          winRate: phaseMetrics?.winRate ?? 0,
          profitProgress: phaseMetrics?.profitProgress ?? 0,
        }
      }),
      currentPnL: currentPhaseNetPnL,
      currentGrossPnL: currentPhaseGrossPnL,
      currentNetPnL: currentPhaseNetPnL,
      currentBalance: currentBalance,
      currentEquity: currentEquity,
      dailyDrawdownRemaining: drawdownData.dailyDrawdownRemaining,
      maxDrawdownRemaining: drawdownData.maxDrawdownRemaining,
      profitTargetProgress: currentPhase && currentPhase.profitTargetPercent > 0
        ? Math.min(Math.round((currentPhaseGrossPnL / (masterAccount.accountSize * currentPhase.profitTargetPercent / 100)) * 1000) / 10, 100)
        : 0,
      lastUpdated: new Date().toISOString()
    }

    const currentPhaseStatus = String(currentPhase?.status || '').toLowerCase()
    const isFinished =
      String(masterAccount.status || '').toLowerCase() === 'failed' ||
      (currentPhase ? currentPhaseStatus !== 'active' : false)
    const latestTradeTimestamp = getLatestTradeTimestamp(currentPhaseGroupedTrades)
    const referenceDate = isFinished
      ? latestTradeTimestamp || new Date()
      : new Date()
    const widgetMetricsVersion = `${currentPhaseGroupedTrades.length}-${latestTradeTimestamp?.getTime() ?? 'empty'}`
    const widgetMetrics = await withCache(
      CacheKeys.propFirmWidgetMetrics(masterAccountId, resetTimezone, widgetMetricsVersion),
      CacheTTL.propFirmWidgetMetrics,
      async () => {
        const growthResult = buildPropFirmGrowth(accountData, currentPhaseGroupedTrades, resetTimezone)
        return {
          accountExtremes: buildPropFirmAccountExtremes(currentPhaseGroupedTrades),
          dailyDrawdown: buildPropFirmDailyDrawdown(accountData, currentPhaseGroupedTrades, resetTimezone, referenceDate, drawdownData),
          todayStats: buildPropFirmTodayStats(currentPhaseGroupedTrades, resetTimezone, referenceDate),
          growth: growthResult.points,
          peakEquity: growthResult.peakEquity,
          maxDrawdown: growthResult.maxDrawdown,
          tradingDays: growthResult.tradingDays,
          groupedTradeCount: currentPhaseGroupedTrades.length,
          resetTimezone,
          referenceDate: referenceDate.toISOString(),
        }
      },
    )

    const response = {
      account: accountData,
      drawdown: drawdownData,
      widgetMetrics,
      // Keep the full data for backward compatibility
      masterAccount: {
        id: masterAccount.id,
        accountName: masterAccount.accountName,
        propFirmName: masterAccount.propFirmName,
        accountSize: masterAccount.accountSize,
        evaluationType: masterAccount.evaluationType,
        currentPhase: masterAccount.currentPhase,
        status: masterAccount.status,
        createdAt: masterAccount.createdAt,
        owner: { id: masterAccount.userId, email: '' }
      },
      phases: phases.map((phase: typeof phases[number]) => {
        const phaseMetrics = phaseMetricsById.get(phase.id)
        return {
          id: phase.id,
          phaseNumber: phase.phaseNumber,
          phaseId: phase.phaseId,
          status: phase.status,
          profitTargetPercent: phase.profitTargetPercent,
          dailyDrawdownPercent: phase.dailyDrawdownPercent,
          maxDrawdownPercent: phase.maxDrawdownPercent,
          minTradingDays: phase.minTradingDays,
          timeLimitDays: phase.timeLimitDays,
          consistencyRulePercent: phase.consistencyRulePercent,
          profitSplitPercent: phase.profitSplitPercent,
          payoutCycleDays: phase.payoutCycleDays,
          startDate: phase.startDate,
          endDate: phase.endDate,
          tradeCount: phaseMetrics?.tradeCount ?? 0,
          totalPnL: phaseMetrics?.totalPnL ?? 0,
          wins: phaseMetrics?.wins ?? 0,
          losses: phaseMetrics?.losses ?? 0,
          breakEvenTrades: phaseMetrics?.breakEvenTrades ?? 0,
          winRate: phaseMetrics?.winRate ?? 0,
          profitProgress: phaseMetrics?.profitProgress ?? 0,
        }
      }),
      currentPhase: currentPhase ? {
        id: currentPhase.id,
        phaseNumber: currentPhase.phaseNumber,
        phaseId: currentPhase.phaseId,
        status: currentPhase.status,
        rules: {
          profitTargetPercent: currentPhase.profitTargetPercent,
          dailyDrawdownPercent: currentPhase.dailyDrawdownPercent,
          maxDrawdownPercent: currentPhase.maxDrawdownPercent,
          minTradingDays: currentPhase.minTradingDays,
          timeLimitDays: currentPhase.timeLimitDays,
          consistencyRulePercent: currentPhase.consistencyRulePercent
        },
        payout: isFundedPhase(masterAccount.evaluationType, currentPhase.phaseNumber) ? {
          profitSplitPercent: currentPhase.profitSplitPercent,
          payoutCycleDays: currentPhase.payoutCycleDays
        } : null
      } : null,
      statistics: {
        totalTrades,
        totalPnL,
        winningTrades,
        losingTrades,
        breakEvenTrades: Math.max(0, totalTrades - winningTrades - losingTrades),
        winRate,
        currentPhaseTrades: currentPhaseTradeCount,
        currentPhaseGrossPnL,
        currentPhaseNetPnL
      },
      recentTrades: currentPhaseGroupedTrades.slice(-20).reverse().map((trade: any) => ({  // FIXED: Show recent grouped trades from CURRENT PHASE only
        id: trade.id,
        pnl: trade.pnl,
        commission: trade.commission,
        netPnL: getTradeNetPnl(trade),
        instrument: trade.instrument || trade.symbol,
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        entryPrice: trade.entryPrice,
        closePrice: trade.closePrice,
        exitPrice: trade.closePrice,
        entryDate: trade.entryDate,
        closeDate: trade.closeDate,
        entryTime: trade.entryTime,
        exitTime: trade.exitTime,
        phase: currentPhase ? {
          id: currentPhase.id,
          phaseNumber: currentPhase.phaseNumber
        } : null,
        phaseAccountId: currentPhase?.id
      })),
      summary: {
        totalPhases: phases.length,
        currentPhaseNumber: masterAccount.currentPhase,
        currentPhaseStatus: currentPhase?.status,
        nextAction,
        needsPhaseId: !currentPhase?.phaseId && currentPhase?.status === 'active'
      }
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error: any) {
    logger.error({ error: error?.message, context: 'api' }, 'GET /api/v1/prop-firm/accounts/[id]')
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch account'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const internalUserId = identity.internalUserId

    const { id: masterAccountId } = await params
    // ID is pure masterAccountId (UUID), not composite
    const body = await request.json()
    const updateData = UpdateMasterAccountSchema.parse(body)

    // Verify ownership
    const existingAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.id, masterAccountId),
        eq(table.userId, internalUserId)
      )
    })

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Master account not found or unauthorized' },
        { status: 404 }
      )
    }

    // Update the account
    const updatedAccount = (await db.update(schema.MasterAccount).set(updateData).where(and(
      eq(schema.MasterAccount.id, masterAccountId),
      eq(schema.MasterAccount.userId, internalUserId),
    )).returning())[0]

    // Invalidate caches after archiving/unarchiving to refresh dashboard
    if (typeof updateData.isArchived === 'boolean') {
      const { invalidateUserCaches } = await import('@/server/accounts')
      await invalidateUserCaches(internalUserId)
    }

    return NextResponse.json({
      success: true,
      data: updatedAccount
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update account'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const internalUserId = identity.internalUserId

    const { id: masterAccountId } = await params
    // ID is pure masterAccountId (UUID), not composite

    // Verify ownership first
    const existingAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.id, masterAccountId),
        eq(table.userId, internalUserId)
      ),
      with: {
        PhaseAccount: {
          columns: { id: true, phaseId: true }
        }
      }
    })

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Master account not found or unauthorized' },
        { status: 404 }
      )
    }

    // Delete all associated data in a transaction
    await db.transaction(async (tx) => {
      // Get all phase IDs for this master account
      const phaseIds = existingAccount.PhaseAccount.map(
        (phase: (typeof existingAccount.PhaseAccount)[number]) => phase.id
      )
      // Delete all trades associated with this master account strictly by phaseAccountId UUIDs
      // to prevent deleting trades of other accounts that share the same phaseId or accountName
      if (phaseIds.length > 0) {
        const tradeRows = await tx
          .select({ id: schema.Trade.id })
          .from(schema.Trade)
          .where(inArray(schema.Trade.phaseAccountId, phaseIds))
        const tradeIds = tradeRows.map((trade) => trade.id)

        if (tradeIds.length > 0) {
          await tx.delete(schema.TradeExecution).where(inArray(schema.TradeExecution.tradeId, tradeIds))
          await tx.delete(schema.Trade).where(inArray(schema.Trade.id, tradeIds))
        }

        await tx.delete(schema.DailyAnchor).where(inArray(schema.DailyAnchor.phaseAccountId, phaseIds))
        await tx.delete(schema.BreachRecord).where(inArray(schema.BreachRecord.phaseAccountId, phaseIds))
        await tx.delete(schema.Payout).where(inArray(schema.Payout.phaseAccountId, phaseIds))
      }

      // Delete all phase accounts
      if (phaseIds.length > 0) {
        await tx.delete(schema.PhaseAccount).where(eq(schema.PhaseAccount.masterAccountId, masterAccountId))
      }

      // Finally delete the master account
      await tx.delete(schema.MasterAccount).where(and(
        eq(schema.MasterAccount.id, masterAccountId),
        eq(schema.MasterAccount.userId, internalUserId),
      ))
    })

    // Invalidate all cache tags to ensure fresh data
    const { invalidateUserCaches } = await import('@/server/accounts')
    await invalidateUserCaches(internalUserId)

    return NextResponse.json({
      success: true,
      message: 'Master account deleted successfully'
    })

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete account'
      },
      { status: 500 }
    )
  }
}
