import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { getUserAccessStatus } from '@/lib/services/subscription-service'
import { db } from '@/lib/db/client'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
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

    const user = await db.query.User.findFirst({
      where: (table, { eq }) => eq(table.id, identity.internalUserId),
    })

    const access = await getUserAccessStatus(identity.internalUserId, user?.role ?? undefined)

    return createSuccessResponse(
      {
        hasAccess: access.hasAccess,
        status: access.status,
        reason: access.reason,
        currentPeriodEnd: access.subscription?.currentPeriodEnd,
        nextPaymentDue: access.subscription?.nextPaymentDue,
      },
      undefined,
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'get-subscription-status',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to check status',
      500,
      undefined,
      'SUBSCRIPTION_STATUS_FAILED',
      requestId,
    )
  }
}
