import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

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

    const internalUserId = identity.internalUserId
    const { id: accountId } = await params

    const account = await db.query.Account.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.id, accountId),
        eq(table.userId, internalUserId)
      ),
      columns: {
        id: true,
        number: true
      }
    })

    if (!account) {
      return createErrorResponse('Account not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    const trades = await db.query.Trade.findMany({
      where: (table, { and, eq }) => and(
        eq(table.accountId, account.id),
        eq(table.userId, internalUserId),
      ),
      columns: {
        id: true,
        pnl: true,
        commission: true,
        entryDate: true,
        closeDate: true,
        instrument: true,
        side: true,
        quantity: true,
        entryPrice: true,
        closePrice: true,
        createdAt: true,
      },
      orderBy: (table, { desc }) => [desc(table.entryDate)]
    })

    return createSuccessResponse(trades, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'list-account-trades',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to fetch trades',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}
