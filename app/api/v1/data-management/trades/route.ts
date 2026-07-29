import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { and, or, eq, isNull, inArray, not, desc, count } from 'drizzle-orm'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const internalUserId = identity.internalUserId

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
    const offset = (page - 1) * limit

    // Fetch trades for this user without any specific account/status filters
    // This is for the Data Management "everything" view
    const [trades, totalResult] = await Promise.all([
      db.query.Trade.findMany({
        where: (table, { and, or, eq, isNull, not, inArray }) => and(
          eq(table.userId, internalUserId),
          or(
            isNull(table.phaseAccountId),
            not(
              // Note: relation filter approximated; may require exists/notExists in full Drizzle setup
              inArray(schema.PhaseAccount.status, ['pending', 'pending_approval'])
            )
          )
        ),
        orderBy: (table, { desc }) => [desc(table.exitTime)],
        limit,
        offset,
      }),
      db.select({ count: count() })
        .from(schema.Trade)
        .where(and(
          eq(schema.Trade.userId, internalUserId),
          or(
            isNull(schema.Trade.phaseAccountId),
            not(inArray(schema.PhaseAccount.status, ['pending', 'pending_approval']))
          )
        ))
    ])

    const total = totalResult[0]?.count || 0

    return createSuccessResponse(
      trades,
      undefined,
      {
        pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
        },
      },
      requestId,
    )

  } catch (error) {
    reportError(error, { surface: 'api', operation: 'list-data-management-trades', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Internal server error', 500, undefined, 'DATA_MANAGEMENT_TRADES_FAILED', requestId)
  }
}
