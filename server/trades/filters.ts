import { and, arrayOverlaps, eq, gte, ilike, inArray, isNotNull, lt, lte, or, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { Trade } from '@/lib/db/schema'

export const MAX_ANALYTICS_TRADE_LIMIT = 100_000
const DEFAULT_ANALYTICS_TRADE_LIMIT = 5_000
export const MAX_TABLE_PAGE_LIMIT = 500
const MAX_FILTER_VALUES = 100

const boundedListSchema = (max = MAX_FILTER_VALUES) => z.string().nullish().transform((value) => {
  if (!value) return []
  return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, max)
})

export const getTradesSchema = z.object({
  accounts: boundedListSchema(),
  dateFrom: z.string().nullish(),
  dateTo: z.string().nullish(),
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().catch(null),
  instruments: boundedListSchema(),
  pnlMin: z.string().nullish().transform((value) => value ? parseFloat(value) : undefined).pipe(z.number().optional().catch(undefined)),
  pnlMax: z.string().nullish().transform((value) => value ? parseFloat(value) : undefined).pipe(z.number().optional().catch(undefined)),
  timeRange: z.string().nullish(),
  weekday: z.string().nullish().transform((value) => value ? parseInt(value, 10) : null).pipe(z.number().min(0).max(6).nullable().catch(null)),
  hour: z.string().nullish().transform((value) => value ? parseInt(value, 10) : null).pipe(z.number().min(0).max(23).nullable().catch(null)),
  includeStats: z.string().nullish().transform((value) => value !== 'false'),
  includeCalendar: z.string().nullish().transform((value) => value !== 'false'),
  groupByExecution: z.string().nullish().transform((value) => value === 'true'),
  includeWidgets: z.string().nullish().transform((value) => value !== 'false'),
  metricsOnly: z.string().nullish().transform((value) => value === 'true'),
  pageLimit: z.string().nullish().transform((value) => value ? parseInt(value, 10) : null).pipe(z.number().min(1).max(MAX_TABLE_PAGE_LIMIT).nullable().catch(null)),
  pageOffset: z.string().nullish().transform((value) => value ? parseInt(value, 10) : 0).pipe(z.number().min(0).max(1_000_000).catch(0)),
  limit: z.string().nullish(),
  timezone: z.string().nullish().transform((value) => value ? value.slice(0, 64) : 'UTC'),
  search: z.string().nullish().transform((value) => value ? value.trim().slice(0, 120) : ''),
  side: z.string().nullish().transform((value) => value ? value.trim().slice(0, 16) : ''),
  outcome: z.string().nullish().transform((value) => value ? value.trim() : ''),
  tags: boundedListSchema(),
  liveOnly: z.string().nullish().transform((value) => value === 'true'),
})

export type TradeQueryFilters = z.infer<typeof getTradesSchema>

export const TRADE_SELECT = {
  id: true, entryDate: true, closeDate: true, pnl: true, commission: true,
  instrument: true, side: true, accountNumber: true, timeInPosition: true,
  quantity: true, entryId: true, groupId: true, phaseAccountId: true,
  entryPrice: true, entryPriceValue: true, closePrice: true, closePriceValue: true,
  stopLoss: true, stopLossValue: true, takeProfit: true, takeProfitValue: true,
  closeReason: true, comment: true, cardPreviewImage: true, cardPreviewTransform: true,
  imageOne: true, imageTwo: true, imageThree: true, imageFour: true,
  imageFive: true, imageSix: true, tags: true, marketBias: true, modelId: true,
  selectedRules: true, outcome: true, ruleBroken: true, newsDay: true,
  selectedNews: true, newsTraded: true, biasTimeframe: true, narrativeTimeframe: true,
  entryTimeframe: true, structureTimeframe: true, orderType: true, chartLinks: true,
  chartLinksList: true, tradeIdentityKey: true, userId: true, mae: true, mfe: true,
  setup: true, entryTime: true, exitTime: true, symbol: true,
} as const

export function needsTradeAnalytics(filters: TradeQueryFilters) {
  return filters.includeStats || filters.includeCalendar || filters.includeWidgets || filters.groupByExecution || filters.metricsOnly
}

export function normalizeTradeLimit(filters: TradeQueryFilters) {
  const needsAnalytics = needsTradeAnalytics(filters)
  const rawLimit = filters.limit ? parseInt(filters.limit, 10) : Number.NaN
  const needsPostQueryFilters = filters.weekday !== null || filters.hour !== null
  const fallback = needsAnalytics || needsPostQueryFilters ? DEFAULT_ANALYTICS_TRADE_LIMIT : (filters.pageLimit || MAX_TABLE_PAGE_LIMIT)
  const max = needsAnalytics || needsPostQueryFilters || filters.pageLimit === null
    ? MAX_ANALYTICS_TRADE_LIMIT
    : MAX_TABLE_PAGE_LIMIT
  return Number.isNaN(rawLimit) ? fallback : Math.min(max, Math.max(1, rawLimit))
}

export function canUseDirectPagination(filters: TradeQueryFilters) {
  return !needsTradeAnalytics(filters) && filters.pageLimit !== null && filters.weekday === null && filters.hour === null && !filters.outcome
}

export async function buildTradeWhere(internalUserId: string, filters: TradeQueryFilters): Promise<SQL> {
  const whereConditions: SQL[] = [eq(Trade.userId, internalUserId)]

  if (filters.liveOnly) {
    whereConditions.push(isNotNull(Trade.tradeIdentityKey))
  }

  if (filters.accounts.length > 0) {
    const [userAccounts, ownedMasters] = await Promise.all([
      db.query.Account.findMany({
        where: (table, operators) => and(
          eq(table.userId, internalUserId),
          operators.or(inArray(table.id, filters.accounts), inArray(table.number, filters.accounts)),
        ),
        columns: { id: true, number: true },
      }),
      db.query.MasterAccount.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        columns: { id: true },
      }),
    ])

    const masterIds = ownedMasters.map(({ id }) => id)
    const userPhaseAccounts = masterIds.length > 0
      ? await db.query.PhaseAccount.findMany({
        where: (table, { inArray }) => inArray(table.masterAccountId, masterIds),
        columns: { id: true, phaseId: true },
      })
      : []

    const accountIds = userAccounts.map(({ id }) => id)
    const accountNumbers = userAccounts.map(({ number }) => number)
    const phaseIds = userPhaseAccounts.map(({ id }) => id)
    const phaseNumbers = userPhaseAccounts.map(({ phaseId }) => phaseId).filter(Boolean) as string[]
    const rawNumbers = filters.accounts.filter((value) => !accountIds.includes(value) && !phaseIds.includes(value))
    const accountConditions: SQL[] = []

    if (accountIds.length > 0) accountConditions.push(inArray(Trade.accountId, accountIds))
    if (phaseIds.length > 0) accountConditions.push(inArray(Trade.phaseAccountId, phaseIds))

    const numberValues = [...accountNumbers, ...phaseNumbers, ...rawNumbers]
    if (numberValues.length > 0) accountConditions.push(inArray(Trade.accountNumber, numberValues))
    if (accountConditions.length > 0) whereConditions.push(or(...accountConditions)!)
  }

  if (filters.tradeDate) {
    whereConditions.push(or(
      and(
        gte(Trade.closeDate, `${filters.tradeDate}T00:00:00.000Z`),
        lte(Trade.closeDate, `${filters.tradeDate}T23:59:59.999Z`),
      ),
      and(
        eq(Trade.closeDate, ''),
        gte(Trade.entryDate, `${filters.tradeDate}T00:00:00.000Z`),
        lte(Trade.entryDate, `${filters.tradeDate}T23:59:59.999Z`),
      ),
    )!)
  } else {
    if (filters.dateFrom) whereConditions.push(gte(Trade.entryDate, filters.dateFrom.includes('T') ? filters.dateFrom : `${filters.dateFrom}T00:00:00.000Z`))
    if (filters.dateTo) whereConditions.push(lte(Trade.entryDate, filters.dateTo.includes('T') ? filters.dateTo : `${filters.dateTo}T23:59:59.999Z`))
  }

  if (filters.instruments.length > 0) whereConditions.push(inArray(Trade.instrument, filters.instruments))
  if (filters.pnlMin !== undefined) whereConditions.push(gte(Trade.pnl, filters.pnlMin))
  if (filters.pnlMax !== undefined) whereConditions.push(lte(Trade.pnl, filters.pnlMax))

  const timeRanges: Record<string, [number, number]> = {
    under1min: [0, 60], '1to5min': [60, 300], '5to10min': [300, 600],
    '10to15min': [600, 900], '15to30min': [900, 1800], '30to60min': [1800, 3600],
    '1to2hours': [3600, 7200], '2to5hours': [7200, 18000], over5hours: [18000, 999999999],
  }
  const timeRange = filters.timeRange ? timeRanges[filters.timeRange] : undefined
  if (timeRange) {
    whereConditions.push(gte(Trade.timeInPosition, timeRange[0]), lt(Trade.timeInPosition, timeRange[1]))
  }

  if (filters.tags.length > 0) whereConditions.push(arrayOverlaps(Trade.tags, filters.tags))
  if (filters.side) whereConditions.push(ilike(Trade.side, filters.side))
  if (filters.search) whereConditions.push(or(
    ilike(Trade.instrument, `%${filters.search}%`),
    ilike(Trade.symbol, `%${filters.search}%`),
    ilike(Trade.comment, `%${filters.search}%`),
  )!)

  return and(...whereConditions)!
}
