import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
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
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { calculateBalanceInfo } from '@/lib/utils/balance-calculator'
import { normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import { getRuntimePnlDisplayMode } from '@/server/user-settings'
import { eq, inArray } from 'drizzle-orm'
import { withCache } from '@/lib/cache/helpers'
import { CacheKeys, CacheTTL } from '@/lib/cache/keys'

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type')
  
  if (!type) {
    return NextResponse.json({ error: 'Missing widget type' }, { status: 400 })
  }

  const identity = await getResolvedUserIdentitySafe()
  const internalUserId = identity?.internalUserId

  if (!internalUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Define unique parameters for cache key
  const queryParams = request.nextUrl.searchParams.toString()
  const cacheKey = CacheKeys.widgetData(internalUserId, type, queryParams)

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

      const data = await tradesResponse.json()
      const trades = data.trades || []

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
            Sentry.captureException(error, { extra: { route: '/api/v1/dashboard/widgets' } })
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
     return NextResponse.json({ error: 'Failed to generate widget data' }, { status: 500 })
  }

  return NextResponse.json(cachedResult)
}