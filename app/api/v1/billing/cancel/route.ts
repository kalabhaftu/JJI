import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import {
  cancelOwnedWhopMembershipAtPeriodEnd,
  WhopMembershipNotFoundError,
} from '@/lib/services/whop/cancellation'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'payment')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const membership = await cancelOwnedWhopMembershipAtPeriodEnd({
      userId: identity.internalUserId,
      requestId,
    })

    return createSuccessResponse({
      cancelAtPeriodEnd: membership.cancelAtPeriodEnd,
      currentPeriodEnd: membership.currentPeriodEnd,
    }, 'Your subscription will not renew.', undefined, requestId)
  } catch (error) {
    if (error instanceof WhopMembershipNotFoundError) {
      return createErrorResponse(error.message, 404, undefined, 'WHOP_MEMBERSHIP_NOT_FOUND', requestId)
    }

    reportError(error, {
      surface: 'api',
      operation: 'cancel-whop-membership-at-period-end',
      route: request.nextUrl.pathname,
      requestId,
      tags: { provider: 'whop' },
    })
    return createErrorResponse(
      'We could not cancel the subscription. No local billing state was changed.',
      502,
      undefined,
      'WHOP_CANCELLATION_FAILED',
      requestId,
    )
  }
}
