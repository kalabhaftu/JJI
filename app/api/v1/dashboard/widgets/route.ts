import { NextRequest } from 'next/server'
import { GET as getTrades } from '@/app/api/v1/trades/route'
import {
  calculateDayOfWeekPerformance,
  calculateOutcomeDistribution,
  calculateEquityCurve,
  calculateNetDailyPnl,
  calculateDailyCumulativePnl,
  calculateAccountBalanceChart,
  calculateCalendarData,
  calculateSessionAnalysis
} from '@/lib/dashboard/analytics-calculations'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { calculateBalanceInfo } from '@/lib/utils/balance-calculator'
import { normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import { getRuntimePnlDisplayMode } from '@/server/user-settings'
import { eq, inArray } from 'drizzle-orm'
import { withCache, getUserCacheVersion } from '@/lib/cache/helpers'
import { CacheKeys, CacheTTL } from '@/lib/cache/keys'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited
  const type = request.nextUrl.searchParams.get('type')
  
  if (!type) {
    return createErrorResponse('Missing widget type', 400, undefined, 'VALIDATION_ERROR', requestId)
  }

  const identity = await getResolvedUserIdentitySafe()
  const internalUserId = identity?.internalUserId

  if (!internalUserId) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
  }

  // Define unique parameters for cache key with user versioning
  const userVersion = await getUserCacheVersion(internalUserId)
  const queryParams = request.nextUrl.searchParams.toString()
  const cacheKey = CacheKeys.widgetData(internalUserId, type, queryParams, userVersion)

  const cachedResult = await withCache(
    cacheKey,
    CacheTTL.widgetData,
    async () => {
      // Optimize upstream trades query to skip stats and calendar math
      request.nextUrl.searchParams.set('includeStats', 'false')
      request.nextUrl.searchParams.set('includeCalendar', 'false')

      // Fetch filtered trades using the existing robust trades API
      const tradesResponse = await getTrades(request)
      if (tradesResponse.status !== 200) {
        throw new Error('Failed to fetch trades')
      }

      const payload = await tradesResponse.json()
      const trades = payload.data?.trades || []

      // Route to the appropriate math function
      let result
      switch (type) {
        case 'dayOfWeekPerformance':
          result = calculateDayOfWeekPerformance(trades)
          break
        case 'outcomeDistribution':
          result = calculateOutcomeDistribution(trades)
          break
        case 'equityCurve':
          result = calculateEquityCurve(trades)
          break
        case 'netDailyPnl':
          result = calculateNetDailyPnl(trades)
          break
        case 'dailyCumulativePnl':
          result = calculateDailyCumulativePnl(trades)
          break
        case 'accountBalanceChart':
          // Fetch user's active accounts to calculate absolute balance
          let activeAccounts = []
          activeAccounts = await db.query.Account.findMany({
            where: (table, { eq, and }) => and(eq(table.userId, internalUserId), eq(table.isArchived, false)),
            columns: { startingBalance: true }
          }) as any[]
          result = calculateAccountBalanceChart(trades, activeAccounts)
          break
        case 'calendarData':
          result = calculateCalendarData(trades)
          break
        case 'sessionAnalysis':
          result = calculateSessionAnalysis(trades)
          break
        case 'accountBalancePnl':
          let userAccounts = []
          let transactions: any[] = []
          userAccounts = await db.query.Account.findMany({
            where: (table, { eq }) => eq(table.userId, internalUserId)
          }) as any[]
          
          const accountNumbers = request.nextUrl.searchParams.get('accounts')?.split(',').filter(Boolean) || []
          let filteredDbAccounts = userAccounts
          if (accountNumbers.length > 0) {
            filteredDbAccounts = userAccounts.filter(acc => accountNumbers.includes(acc.number))
          }
          try {
            const liveAccountIds = filteredDbAccounts
              .filter((account: any) => account.accountType === 'live')
              .map((account: any) => account.id)
              .filter(Boolean)
            if (liveAccountIds.length > 0) {
              transactions = await db.query.LiveAccountTransaction.findMany({
                where: (table, { eq, and, inArray }) => and(
                  eq(table.userId, internalUserId),
                  inArray(table.accountId, liveAccountIds)
                ),
                columns: { accountId: true, amount: true }
              })
            }
          } catch (error) {
            reportError(error, {
              surface: 'api',
              operation: 'load-widget-account-transactions',
              route: request.nextUrl.pathname,
              requestId,
              userId: internalUserId,
            })
            transactions = []
          }
          let pnlDisplayMode = 'net'
          pnlDisplayMode = await getRuntimePnlDisplayMode(internalUserId)
          result = calculateBalanceInfo(filteredDbAccounts, trades, transactions, {
            pnlDisplayMode: normalizePnlDisplayMode(pnlDisplayMode)
          })
          break
        default:
          throw new Error('Unknown widget type')
      }
      return result
    }
  )

  if (!cachedResult) {
     return createErrorResponse('Failed to generate widget data', 500, undefined, 'SERVER_ERROR', requestId)
  }

  return createSuccessResponse(cachedResult, undefined, undefined, requestId)
}
