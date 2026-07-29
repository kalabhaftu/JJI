import { type NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse, ErrorResponses } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { updateDailySyncTimeAction } from '@/server/integrations/tradovate'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

export async function PATCH(request: NextRequest) {
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity?.internalUserId) return ErrorResponses.unauthorized()

  try {
    const body = await request.json() as {
      accountId?: unknown
      utcTimeString?: unknown
    }
    if (
      typeof body.accountId !== 'string'
      || body.accountId.length < 1
      || body.accountId.length > 200
      || (
        body.utcTimeString !== null
        && typeof body.utcTimeString !== 'string'
      )
    ) {
      return ErrorResponses.validation({ fields: ['accountId', 'utcTimeString'] })
    }
    if (
      typeof body.utcTimeString === 'string'
      && Number.isNaN(new Date(body.utcTimeString).getTime())
    ) {
      return ErrorResponses.validation({ fields: ['utcTimeString'] })
    }

    const result = await updateDailySyncTimeAction(
      body.accountId,
      body.utcTimeString as string | null,
      identity.internalUserId,
    )
    if (!result.success) {
      return createErrorResponse(
        result.error ?? 'Failed to update synchronization schedule',
        409,
        undefined,
        'TRADOVATE_SCHEDULE_UPDATE_FAILED',
      )
    }
    return createSuccessResponse(result)
  } catch (error) {
    const requestId = request.headers.get('x-request-id')
    reportError(error, {
      surface: 'api',
      operation: 'update-tradovate-schedule',
      route: '/api/v1/tradovate/synchronizations/schedule',
      userId: identity.internalUserId,
      ...(requestId ? { requestId } : {}),
    })
    return ErrorResponses.serverError()
  }
}
