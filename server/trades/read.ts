import * as Sentry from '@sentry/nextjs'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { Account, LiveAccountTransaction, MasterAccount, Trade, UserSettings } from '@/lib/db/schema'
import { getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import {
  buildTradeWhere,
  canUseDirectPagination,
  MAX_ANALYTICS_TRADE_LIMIT,
  normalizeTradeLimit,
  needsTradeAnalytics,
  TRADE_SELECT,
  type TradeQueryFilters,
} from './filters'
import { applyPostQueryFilters, buildAccounts, buildTradeAnalytics, serializeTrades } from './analytics'
import { reportError } from '@/lib/observability/report-error'

export type TradeResponseMeta =
  | { directPagination: true; truncated: false }
  | { directPagination: false; truncated: boolean }

export async function readTradesForUser(internalUserId: string, filters: TradeQueryFilters) {
  const span = Sentry.startInactiveSpan({
    name: 'trades.read',
    op: 'db.query',
    attributes: {
      'jji.include_stats': filters.includeStats,
      'jji.include_calendar': filters.includeCalendar,
      'jji.include_widgets': filters.includeWidgets,
      'jji.direct_pagination': canUseDirectPagination(filters),
    },
  })
  const needsAnalytics = needsTradeAnalytics(filters)
  const limit = normalizeTradeLimit(filters)
  const finalWhere = await buildTradeWhere(internalUserId, filters)
  const useDirectPagination = canUseDirectPagination(filters)

  const analyticsLimit = filters.metricsOnly ? undefined : limit + (needsAnalytics ? 1 : 0)
  const rawTrades = await db.query.Trade.findMany({
    where: finalWhere,
    orderBy: (table: any, { desc }: any) => [desc(table.entryDate)],
    ...(useDirectPagination
      ? { limit: filters.pageLimit }
      : analyticsLimit !== undefined
        ? { limit: analyticsLimit }
        : {}),
    ...(useDirectPagination ? { offset: filters.pageOffset } : {}),
    columns: TRADE_SELECT,
    with: { TradingModel: { columns: { id: true, name: true } } },
  } as any)
  const totalForDirectPagination = useDirectPagination ? await db.$count(Trade, finalWhere) : null

  const [userSettings, regularAccounts, propFirmAccounts] = await Promise.all([
    db.query.UserSettings.findFirst({
      where: eq(UserSettings.userId, internalUserId),
      columns: { breakEvenThreshold: true, pnlDisplayMode: true },
    }),
    filters.includeStats
      ? db.query.Account.findMany({
        where: eq(Account.userId, internalUserId),
        columns: { id: true, number: true, startingBalance: true },
      })
      : Promise.resolve([]),
    filters.includeStats
      ? db.query.MasterAccount.findMany({
        where: eq(MasterAccount.userId, internalUserId),
        with: { PhaseAccount: { columns: { id: true, phaseId: true, phaseNumber: true, status: true } } },
      })
      : Promise.resolve([]),
  ])

  const breakEvenThreshold = getBreakEvenThreshold(userSettings?.breakEvenThreshold)
  const pnlDisplayMode = normalizePnlDisplayMode(userSettings?.pnlDisplayMode)
  const accounts = buildAccounts(regularAccounts, propFirmAccounts)
  const rawTradesForAnalytics = filters.metricsOnly
    ? rawTrades
    : needsAnalytics && rawTrades.length > limit
      ? rawTrades.slice(0, limit)
      : rawTrades
  const trades = applyPostQueryFilters(serializeTrades(rawTradesForAnalytics), filters, breakEvenThreshold)

  const accountNumbers = filters.accounts
  const filteredAccounts = accountNumbers.length > 0
    ? accounts.filter((account: any) => accountNumbers.includes(account.number) || accountNumbers.includes(account.id))
    : accounts
  let relevantTransactions: any[] = []

  try {
    const liveAccountIds = filteredAccounts
      .filter((account: any) => account.accountType === 'live')
      .map((account: any) => account.id)
      .filter(Boolean)

    if (liveAccountIds.length > 0) {
      relevantTransactions = await db.query.LiveAccountTransaction.findMany({
        where: and(eq(LiveAccountTransaction.userId, internalUserId), inArray(LiveAccountTransaction.accountId, liveAccountIds)),
        columns: { accountId: true, amount: true },
      })
    }
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'load-trade-transactions',
      userId: internalUserId,
      extra: { fallbackUsed: true },
    })
  }

  const analytics = buildTradeAnalytics({
    trades,
    accounts,
    accountNumbers,
    includeStats: filters.includeStats,
    includeCalendar: filters.includeCalendar,
    includeWidgets: filters.includeWidgets,
    groupByExecution: filters.groupByExecution,
    timezone: filters.timezone,
    breakEvenThreshold,
    pnlDisplayMode,
    relevantTransactions,
  })

  const total = useDirectPagination ? (totalForDirectPagination ?? rawTrades.length) : analytics.responseTrades.length
  const pagedTrades = filters.metricsOnly
    ? []
    : useDirectPagination
    ? analytics.responseTrades
    : filters.pageLimit !== null && filters.pageLimit > 0
      ? analytics.responseTrades.slice(filters.pageOffset, filters.pageOffset + filters.pageLimit)
      : analytics.responseTrades

  const meta: TradeResponseMeta = useDirectPagination
    ? { directPagination: true, truncated: false }
    : { directPagination: false, truncated: !filters.metricsOnly && needsAnalytics && rawTrades.length > limit }

  const response = {
    trades: pagedTrades,
    total,
    page: filters.pageLimit !== null ? { limit: filters.pageLimit, offset: filters.pageOffset } : null,
    meta,
    breakEvenThreshold,
    pnlDisplayMode,
    statistics: analytics.statistics,
    calendarData: analytics.calendarData,
    widgets: analytics.widgets,
  }

  span.end()
  return response
}
