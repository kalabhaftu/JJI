import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getBillingStatus } from '@/lib/services/whop/billing-status'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

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
      columns: { role: true },
    })
    const status = await getBillingStatus(identity.internalUserId, user?.role ?? undefined)
    return createSuccessResponse(status, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'get-billing-status',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to load billing status',
      500,
      undefined,
      'BILLING_STATUS_FAILED',
      requestId,
    )
  }
}
