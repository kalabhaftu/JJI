import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

// GET /api/live-accounts/transactions - Get all transactions for user's accounts
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const userId = identity.internalUserId

    // Get all transactions for user's accounts
    const transactions = await db.query.LiveAccountTransaction.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
      orderBy: (table, { desc }) => [desc(table.createdAt)]
    })

    return createSuccessResponse(transactions, undefined, undefined, requestId)

  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'list-live-account-transactions',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Internal server error',
      500,
      undefined,
      'LIVE_ACCOUNT_TRANSACTIONS_FAILED',
      requestId,
    )
  }
}
