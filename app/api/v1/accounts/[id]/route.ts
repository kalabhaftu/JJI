import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { TRADE_COUNT_SELECT, buildGroupedTradeCountSummary } from '@/lib/trade-counts'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { withCache, getUserCacheVersion } from '@/lib/cache/helpers'
import { CacheKeys, CacheTTL } from '@/lib/cache/keys'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { isDomainError } from '@/lib/domain-error'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import {
  deleteLiveAccountForUser,
  updateLiveAccountForUser,
} from '@/server/accounts/lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'authenticated-read')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const { id: accountId } = await params
    const internalUserId = identity.internalUserId
    const userVersion = await getUserCacheVersion(internalUserId)

    const data = await withCache(
      CacheKeys.accountMetrics(accountId, userVersion),
      CacheTTL.accountMetrics,
      async () => {
        const account = await db.query.Account.findFirst({
          where: (table, { eq, and }) => and(eq(table.id, accountId), eq(table.userId, internalUserId)),
        })

        if (!account) return null

        const trades = await db.query.Trade.findMany({
          where: (table, { eq }) => eq(table.accountId, account.id),
          columns: TRADE_COUNT_SELECT,
          orderBy: (table, { desc }) => [desc(table.entryDate)]
        })

        const transactions = await db.query.LiveAccountTransaction.findMany({
          where: (table, { eq }) => eq(table.accountId, account.id),
          columns: {
            amount: true,
          }
        })

        const profitLoss = trades.reduce(
          (sum: number, trade: { pnl: number; commission: number | null }) => sum + trade.pnl,
          0
        )

        const totalTransactions = transactions.reduce(
          (sum: number, tx: { amount: number }) => sum + tx.amount,
          0
        )

        const currentEquity = (account.startingBalance ?? 0) + profitLoss + totalTransactions
        const lastTradeDate = trades.length > 0 ? trades[0]?.entryDate : null
        const tradeCounts = buildGroupedTradeCountSummary(trades as any)

        return {
          id: account.id,
          number: account.number,
          name: account.name,
          broker: account.broker,
          accountType: 'live',
          displayName: account.name || account.number,
          startingBalance: account.startingBalance,
          currentEquity,
          profitLoss,
          status: 'active',
          tradeCount: tradeCounts.groupedTradeCount,
          lastTradeDate,
          createdAt: account.createdAt,
        }
      }
    )

    if (!data) {
      return createErrorResponse('Account not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    return createSuccessResponse(data, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'get-account',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to fetch account', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const internalUserId = identity.internalUserId
    const { id: accountId } = await params
    const body = await request.json() as {
      name?: string
      broker?: string
      isArchived?: boolean
      startingBalance?: number | string
      number?: string
    }
    const { account: updatedAccount } = await updateLiveAccountForUser(
      internalUserId,
      accountId,
      body,
      {
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
      },
    )

    return createSuccessResponse(
      {
        id: updatedAccount.id,
        number: updatedAccount.number,
        name: updatedAccount.name,
        broker: updatedAccount.broker,
        displayName: updatedAccount.name || updatedAccount.number,
        startingBalance: updatedAccount.startingBalance,
        isArchived: updatedAccount.isArchived,
        isConfigured: updatedAccount.isConfigured,
      },
      undefined,
      undefined,
      requestId,
    )
  } catch (error) {
    if (isDomainError(error)) {
      return createErrorResponse(
        error.message,
        error.status,
        undefined,
        error.code,
        requestId,
      )
    }
    reportError(error, {
      surface: 'api',
      operation: 'update-account',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to update account',
      500,
      undefined,
      'ACCOUNT_UPDATE_FAILED',
      requestId,
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const internalUserId = identity.internalUserId
    const { id: accountId } = await params

    await deleteLiveAccountForUser(internalUserId, accountId, {
      source: 'api',
      requestId,
      ipAddress: getClientIp(request.headers),
    })

    return createSuccessResponse(
      { deleted: true },
      'Account and all associated trades deleted successfully',
      undefined,
      requestId,
    )
  } catch (error) {
    if (isDomainError(error)) {
      return createErrorResponse(
        error.message,
        error.status,
        undefined,
        error.code,
        requestId,
      )
    }
    reportError(error, {
      surface: 'api',
      operation: 'delete-account',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to delete account',
      500,
      undefined,
      'ACCOUNT_DELETE_FAILED',
      requestId,
    )
  }
}
