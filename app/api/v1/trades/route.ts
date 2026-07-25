import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { convertDecimal } from '@/lib/utils/decimal'
import { calculateStatistics, classifyTrade, formatCalendarData, groupTradesByExecution } from '@/lib/utils'
import {
  calculateDayOfWeekPerformance,
  calculateOutcomeDistribution,
  calculateEquityCurve,
  calculateNetDailyPnl,
  calculateDailyCumulativePnl,
  calculateAccountBalanceChart,
  calculatePnlByStrategy,
  calculatePnlByInstrument,
  calculateWinRateByStrategy,
  calculateTradeDurationPerformance,
  calculateWeekdayPnl,
  calculatePerformanceScoreResult,
  calculateSessionAnalysis,
  calculateAccountProgression,
  calculateTagPerformance,
  calculateTimeOfDayPerformance,
  calculateDisciplineAnalytics,
  calculatePerformanceSummaryMetrics,
} from '@/lib/dashboard/analytics-calculations'
import { calculateBalanceInfo } from '@/lib/utils/balance-calculator'
import { CacheHeaders } from '@/lib/api-cache-headers'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { getTradeNetPnl, normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import { eq, and, or, inArray, desc, gte, lte, lt, ilike, arrayOverlaps, isNotNull, SQL } from 'drizzle-orm'

const MAX_ANALYTICS_TRADE_LIMIT = 5000
const MAX_TABLE_PAGE_LIMIT = 500
const MAX_FILTER_VALUES = 100

import { z } from 'zod'

// Helper for bounded list
const boundedListSchema = (max = MAX_FILTER_VALUES) => z.string().nullish().transform(val => {
  if (!val) return []
  return val.split(',').map(item => item.trim()).filter(Boolean).slice(0, max)
})

// Schema for GET parameters
const getTradesSchema = z.object({
  accounts: boundedListSchema(),
  dateFrom: z.string().nullish(),
  dateTo: z.string().nullish(),
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().catch(null),
  instruments: boundedListSchema(),
  pnlMin: z.string().nullish().transform(val => val ? parseFloat(val) : undefined).pipe(z.number().optional().catch(undefined)),
  pnlMax: z.string().nullish().transform(val => val ? parseFloat(val) : undefined).pipe(z.number().optional().catch(undefined)),
  timeRange: z.string().nullish(),
  weekday: z.string().nullish().transform(val => val ? parseInt(val, 10) : null).pipe(z.number().min(0).max(6).nullable().catch(null)),
  hour: z.string().nullish().transform(val => val ? parseInt(val, 10) : null).pipe(z.number().min(0).max(23).nullable().catch(null)),
  includeStats: z.string().nullish().transform(val => val !== 'false'),
  includeCalendar: z.string().nullish().transform(val => val !== 'false'),
  groupByExecution: z.string().nullish().transform(val => val === 'true'),
  includeWidgets: z.string().nullish().transform(val => val !== 'false'),
  pageLimit: z.string().nullish().transform(val => val ? parseInt(val, 10) : null).pipe(z.number().min(1).max(MAX_TABLE_PAGE_LIMIT).nullable().catch(null)),
  pageOffset: z.string().nullish().transform(val => val ? parseInt(val, 10) : 0).pipe(z.number().min(0).max(1_000_000).catch(0)),
  limit: z.string().nullish(),
  timezone: z.string().nullish().transform(val => val ? val.slice(0, 64) : 'UTC'),
  search: z.string().nullish().transform(val => val ? val.trim().slice(0, 120) : ''),
  side: z.string().nullish().transform(val => val ? val.trim().slice(0, 16) : ''),
  outcome: z.string().nullish().transform(val => val ? val.trim() : ''),
  tags: boundedListSchema(),
  liveOnly: z.string().nullish().transform(val => val === 'true')
})

// PERF: Only select fields the dashboard actually uses (~40% smaller payload)
const TRADE_SELECT = {
  id: true,
  entryDate: true,
  closeDate: true,
  pnl: true,
  commission: true,
  instrument: true,
  side: true,
  accountNumber: true,
  timeInPosition: true,
  quantity: true,
  entryId: true,
  groupId: true,
  phaseAccountId: true,
  entryPrice: true,
  entryPriceValue: true,
  closePrice: true,
  closePriceValue: true,
  stopLoss: true,
  stopLossValue: true,
  takeProfit: true,
  takeProfitValue: true,
  closeReason: true,
  comment: true,
  cardPreviewImage: true,
  cardPreviewTransform: true,
  imageOne: true,
  imageTwo: true,
  imageThree: true,
  imageFour: true,
  imageFive: true,
  imageSix: true,
  tags: true,
  marketBias: true,
  modelId: true,
  selectedRules: true,
  outcome: true,
  ruleBroken: true,
  newsDay: true,
  selectedNews: true,
  newsTraded: true,
  biasTimeframe: true,
  narrativeTimeframe: true,
  entryTimeframe: true,
  structureTimeframe: true,
  orderType: true,
  chartLinks: true,
  chartLinksList: true,
  tradeIdentityKey: true,
  userId: true,
  mae: true,
  mfe: true,
  setup: true,
  entryTime: true,
  exitTime: true,
  symbol: true,
} as const

export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  const start = Date.now()
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const params = request.nextUrl.searchParams
    
    // Parse filter params using Zod
    const parsedParams = getTradesSchema.safeParse(Object.fromEntries(params.entries()))
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsedParams.error.format() }, { status: 400 })
    }

    const {
      accounts: accountNumbers,
      dateFrom,
      dateTo,
      tradeDate,
      instruments,
      pnlMin,
      pnlMax,
      timeRange,
      weekday,
      hour,
      includeStats,
      includeCalendar,
      groupByExecution,
      includeWidgets,
      pageLimit,
      pageOffset,
      timezone,
      search,
      side,
      outcome,
      tags: tagIds,
      liveOnly
    } = parsedParams.data

    const needsAnalytics = includeStats || includeCalendar || includeWidgets || groupByExecution
    
    // Process limit
    let rawLimitStr = params.get('limit')
    let rawLimit = rawLimitStr ? parseInt(rawLimitStr, 10) : NaN
    const limitFallback = needsAnalytics ? MAX_ANALYTICS_TRADE_LIMIT : (pageLimit || MAX_TABLE_PAGE_LIMIT)
    const limitMax = needsAnalytics ? MAX_ANALYTICS_TRADE_LIMIT : MAX_TABLE_PAGE_LIMIT
    const limit = (!isNaN(rawLimit)) ? Math.min(limitMax, Math.max(1, rawLimit)) : limitFallback
    
    // Build Drizzle where clause - ALL filtering server-side
    const whereConditions: SQL[] = [eq(schema.Trade.userId, internalUserId)]

    if (liveOnly) {
      whereConditions.push(isNotNull(schema.Trade.tradeIdentityKey))
    }
    
    if (accountNumbers.length > 0) {
      // Find the user's regular accounts matching these accountNumbers (either by ID or number)
      const userAccounts = await db.query.Account.findMany({
        where: (table, { or, inArray }) => or(
          inArray(table.id, accountNumbers),
          inArray(table.number, accountNumbers)
        ),
        columns: { id: true, number: true }
      })

      // Find the user's phase accounts matching these accountNumbers (either by ID or phaseId)
      const userPhaseAccounts = await db.query.PhaseAccount.findMany({
        where: (table, { or, inArray }) => or(
          inArray(table.id, accountNumbers),
          inArray(table.phaseId, accountNumbers)
        ),
        columns: { id: true, phaseId: true }
      })

      const resolvedAccountIds = userAccounts.map(a => a.id)
      const resolvedAccountNumbers = userAccounts.map(a => a.number)
      
      const resolvedPhaseAccountIds = userPhaseAccounts.map(pa => pa.id)
      const resolvedPhaseIds = userPhaseAccounts.map(pa => pa.phaseId).filter(Boolean) as string[]

      // For any value in accountNumbers that was NOT a UUID (i.e. did not match any ID),
      // we treat it as a raw number/phaseId directly (for backward compatibility).
      const rawNumbers = accountNumbers.filter(
        num => !resolvedAccountIds.includes(num) && !resolvedPhaseAccountIds.includes(num)
      )

      const accountOrConditions = []
      if (resolvedAccountIds.length > 0) {
        accountOrConditions.push(inArray(schema.Trade.accountId, resolvedAccountIds))
      }
      if (resolvedPhaseAccountIds.length > 0) {
        accountOrConditions.push(inArray(schema.Trade.phaseAccountId, resolvedPhaseAccountIds))
      }
      
      const numberValues = [...resolvedAccountNumbers, ...resolvedPhaseIds, ...rawNumbers]
      if (numberValues.length > 0) {
        accountOrConditions.push(
          and(
            inArray(schema.Trade.accountNumber, numberValues)
          )!
        )
      }

      if (accountOrConditions.length > 0) {
        whereConditions.push(or(...accountOrConditions)!)
      }
    }
    
    if (tradeDate) {
      whereConditions.push(
        or(
          and(
            gte(schema.Trade.closeDate, `${tradeDate}T00:00:00.000Z`),
            lte(schema.Trade.closeDate, `${tradeDate}T23:59:59.999Z`)
          ),
          and(
            eq(schema.Trade.closeDate, ''),
            gte(schema.Trade.entryDate, `${tradeDate}T00:00:00.000Z`),
            lte(schema.Trade.entryDate, `${tradeDate}T23:59:59.999Z`)
          )
        )!
      )
    } else if (dateFrom || dateTo) {
      if (dateFrom) {
        whereConditions.push(gte(schema.Trade.entryDate, dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`))
      }
      if (dateTo) {
        whereConditions.push(lte(schema.Trade.entryDate, dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`))
      }
    }

    if (instruments.length > 0) {
      whereConditions.push(inArray(schema.Trade.instrument, instruments))
    }
    
    if (pnlMin !== undefined || pnlMax !== undefined) {
      if (pnlMin !== undefined) whereConditions.push(gte(schema.Trade.pnl, pnlMin))
      if (pnlMax !== undefined) whereConditions.push(lte(schema.Trade.pnl, pnlMax))
    }
    
    if (timeRange) {
      const timeRanges: Record<string, [number, number]> = {
        'under1min': [0, 60],
        '1to5min': [60, 300],
        '5to10min': [300, 600],
        '10to15min': [600, 900],
        '15to30min': [900, 1800],
        '30to60min': [1800, 3600],
        '1to2hours': [3600, 7200],
        '2to5hours': [7200, 18000],
        'over5hours': [18000, 999999999],
      }
      const range = timeRanges[timeRange]
      if (range) {
        whereConditions.push(gte(schema.Trade.timeInPosition, range[0]))
        whereConditions.push(lt(schema.Trade.timeInPosition, range[1]))
      }
    }
    
    if (tagIds.length > 0) {
      whereConditions.push(arrayOverlaps(schema.Trade.tags, tagIds))
    }

    if (side) {
      whereConditions.push(ilike(schema.Trade.side, side))
    }

    if (search) {
      whereConditions.push(
        or(
          ilike(schema.Trade.instrument, `%${search}%`),
          ilike(schema.Trade.symbol, `%${search}%`),
          ilike(schema.Trade.comment, `%${search}%`)
        )!
      )
    }
    
    const finalWhere = and(...whereConditions)

    // PERF: Fetch trades (slim select) + accounts (both regular and prop firm) in parallel
    const useDirectPagination = !needsAnalytics && pageLimit !== null && weekday === null && hour === null && !outcome
    const tradeQuery = {
      where: finalWhere,
      orderBy: (table: any, { desc }: any) => [desc(table.entryDate)],
      limit: useDirectPagination ? pageLimit : limit,
      ...(useDirectPagination ? { offset: pageOffset } : {}),
      columns: TRADE_SELECT,
      with: { TradingModel: { columns: { id: true, name: true } } },
    }

    const rawTrades = await db.query.Trade.findMany(tradeQuery)
    const totalForDirectPagination = useDirectPagination
      ? await db.$count(schema.Trade, finalWhere)
      : null
    const userSettings = await db.query.UserSettings.findFirst({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      columns: {
        breakEvenThreshold: true,
        pnlDisplayMode: true,
      }
    })
    const regularAccounts = includeStats ? await db.query.Account.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      columns: { id: true, number: true, startingBalance: true }
    }) : []
    const propFirmAccounts = includeStats ? await db.query.MasterAccount.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      with: {
        PhaseAccount: {
          columns: { id: true, phaseId: true, phaseNumber: true, status: true }
        }
      }
    }) : []

    const breakEvenThreshold = getBreakEvenThreshold(userSettings?.breakEvenThreshold)
    const pnlDisplayMode = normalizePnlDisplayMode(userSettings?.pnlDisplayMode)
    
    // Combine regular accounts + transform prop firm phases to unified format with startingBalance
    const accounts = [
      ...regularAccounts,
      ...propFirmAccounts.flatMap((master: any) => 
        (master.PhaseAccount || []).map((phase: any) => ({
          id: phase.id,
          number: phase.phaseId,
          startingBalance: master.accountSize, // Use master account size
          accountType: 'prop-firm' as const,
          status: phase.status,
          currentPhaseDetails: {
            phaseNumber: phase.phaseNumber,
            status: phase.status,
            masterAccountId: master.id,
            masterAccountName: master.accountName,
          }
        }))
      )
    ]
    
    // Convert decimals
    let trades = rawTrades.map((trade: any) => ({
      ...trade,
      entryPrice: convertDecimal(trade.entryPrice),
      closePrice: convertDecimal(trade.closePrice),
      stopLoss: convertDecimal(trade.stopLoss),
      takeProfit: convertDecimal(trade.takeProfit),
      tradingModel: trade.TradingModel?.name || null,
    }))

    // Post-query filters (can't be done in Prisma WHERE)
    if (weekday !== null) {
      trades = trades.filter((trade: any) => {
        if (!trade.entryDate) return false
        return new Date(trade.entryDate).getDay() === weekday
      })
    }
    if (hour !== null) {
      trades = trades.filter((trade: any) => {
        if (!trade.entryDate) return false
        return new Date(trade.entryDate).getHours() === hour
      })
    }
    if (outcome === 'win' || outcome === 'loss' || outcome === 'breakeven') {
      trades = trades.filter((trade: any) => {
        const pnl = getTradeNetPnl(trade)
        return classifyTrade(pnl, breakEvenThreshold) === outcome
      })
    }
    
    // PERF: Group trades ONCE, pass to all grouped consumers
    const grouped = (includeStats || includeCalendar || groupByExecution)
      ? groupTradesByExecution(trades)
      : undefined
    const statistics = includeStats ? calculateStatistics(trades, accounts, grouped, breakEvenThreshold) : null
    const calendarData = includeCalendar ? formatCalendarData(trades, accounts, timezone, grouped) : null

    const responseTrades = groupByExecution ? (grouped ?? groupTradesByExecution(trades)) : trades

    // Filter accounts to match selected account numbers (for balance calculation)
    const filteredAccounts = accountNumbers.length > 0
      ? accounts.filter((acc: any) => accountNumbers.includes(acc.number) || accountNumbers.includes(acc.id))
      : accounts
    
    // PERF: Compute all widget chart data server-side (trades already in memory)
    // This eliminates 6 separate /api/v1/dashboard/widgets calls
    const widgetCalendarData = includeWidgets
      ? (calendarData || formatCalendarData(trades as any, accounts as any, timezone, grouped as any))
      : null

    let relevantTransactions: any[] = []
    try {
      const liveAccountIds = filteredAccounts
        .filter((account: any) => account.accountType === 'live')
        .map((account: any) => account.id)
        .filter(Boolean)
      if (liveAccountIds.length > 0) {
        relevantTransactions = await db.query.LiveAccountTransaction.findMany({
          where: (table, { and, inArray }) => and(
            eq(table.userId, internalUserId),
            inArray(table.accountId, liveAccountIds)
          ),
          columns: { accountId: true, amount: true },
        })
      }
    } catch {
      relevantTransactions = []
    }

    const safeWidget = <T>(fn: () => T, fallback: T): T => {
      try { return fn() } catch { return fallback }
    }
    const zeroBalanceResult = {
      startingBalance: 0, currentBalance: 0, currentGrossBalance: 0,
      totalPnL: 0, grossPnL: 0, totalFees: 0, totalCommissions: 0,
      netPnL: 0, displayPnL: 0, displayBalance: 0, pnlDisplayMode: 'net' as const,
      changeAmount: 0, changePercent: 0,
    }
    const widgets = includeWidgets ? {
      equityCurve: safeWidget(() => calculateEquityCurve(trades), []),
      netDailyPnl: safeWidget(() => calculateNetDailyPnl(trades, breakEvenThreshold), []),
      dailyCumulativePnl: safeWidget(() => calculateDailyCumulativePnl(trades, breakEvenThreshold), []),
      outcomeDistribution: safeWidget(() => calculateOutcomeDistribution(trades, breakEvenThreshold), { data: [], totalTrades: 0 } as any),
      dayOfWeekPerformance: safeWidget(() => calculateDayOfWeekPerformance(trades, breakEvenThreshold), []),
      accountBalanceChart: safeWidget(() => calculateAccountBalanceChart(trades, filteredAccounts, breakEvenThreshold), []),
      pnlByStrategy: safeWidget(() => calculatePnlByStrategy(trades, breakEvenThreshold), []),
      pnlByInstrument: safeWidget(() => calculatePnlByInstrument(trades, breakEvenThreshold), []),
      winRateByStrategy: safeWidget(() => calculateWinRateByStrategy(trades, breakEvenThreshold), []),
      tradeDurationPerformance: safeWidget(() => calculateTradeDurationPerformance(trades, breakEvenThreshold), []),
      weekdayPnl: safeWidget(() => calculateWeekdayPnl(trades, breakEvenThreshold), []),
      performanceScore: safeWidget(() => calculatePerformanceScoreResult(trades, breakEvenThreshold), { hasData: false } as any),
      performanceSummary: safeWidget(() => calculatePerformanceSummaryMetrics(trades), { maxDrawdown: 0, avgDrawdown: 0, rCoverage: { total: 0, valid: 0, all: 0 } }),
      sessionAnalysis: safeWidget(() => calculateSessionAnalysis(trades, breakEvenThreshold), {} as any),
      accountProgression: safeWidget(() => calculateAccountProgression(trades, filteredAccounts, breakEvenThreshold), { cumulative: [], balance: [], summary: {} } as any),
      tagPerformance: safeWidget(() => calculateTagPerformance(trades, breakEvenThreshold), {} as any),
      timeOfDayPerformance: safeWidget(() => calculateTimeOfDayPerformance(trades, breakEvenThreshold), []),
      disciplineAnalytics: safeWidget(() => calculateDisciplineAnalytics(trades, breakEvenThreshold), { totalTrades: 0, brokenRules: 0, ruleBrokenRate: 0, ruleCoverage: 0, avgRulesPerTaggedTrade: 0, playbooks: [] } as any),
      calendarData: widgetCalendarData,
      accountBalancePnl: safeWidget(() => calculateBalanceInfo(filteredAccounts, trades, relevantTransactions, { pnlDisplayMode }), zeroBalanceResult),
    } : null

    const total = useDirectPagination ? (totalForDirectPagination ?? rawTrades.length) : responseTrades.length
    const pagedTrades = useDirectPagination
      ? responseTrades
      : pageLimit !== null && pageLimit > 0
        ? responseTrades.slice(pageOffset, pageOffset + pageLimit)
        : responseTrades
    const truncated = needsAnalytics && rawTrades.length >= MAX_ANALYTICS_TRADE_LIMIT

    const response = NextResponse.json({
      trades: pagedTrades,
      total,
      page: pageLimit !== null ? { limit: pageLimit, offset: pageOffset } : null,
      meta: { directPagination: useDirectPagination, truncated },
      breakEvenThreshold,
      pnlDisplayMode,
      statistics,
      calendarData,
      widgets,
    })
    Object.entries(CacheHeaders.privateShort).forEach(([k, v]) => response.headers.set(k, v))

    logger.info({ latencyMs: Date.now() - start, total: trades.length, layer: 'api' }, 'GET /api/v1/trades')
    return response

  } catch (error: any) {
    logger.error({ error: error?.message, latencyMs: Date.now() - start, layer: 'api' }, 'GET /api/v1/trades failed')
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message?.includes('User not found')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
