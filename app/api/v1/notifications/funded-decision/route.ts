import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import {
  approveFundedAccountForUser,
  declineFundedAccountForUser,
} from '@/server/accounts/funded-decision'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    const body = await request.json().catch(() => null)
    if (
      !body
      || !['approved', 'declined'].includes(body.decision)
      || typeof body.notificationId !== 'string'
      || typeof body.masterAccountId !== 'string'
    ) {
      return createErrorResponse('Invalid funded decision', 400, undefined, 'VALIDATION_ERROR', requestId)
    }
    const context = { requestId, ipAddress: getClientIp(request.headers) }
    if (body.decision === 'approved') {
      if (typeof body.fundedAccountId !== 'string' || !body.fundedAccountId.trim()) {
        return createErrorResponse('Funded account ID is required', 400, undefined, 'VALIDATION_ERROR', requestId)
      }
      await approveFundedAccountForUser({
        userId: identity.internalUserId,
        notificationId: body.notificationId,
        masterAccountId: body.masterAccountId,
        fundedAccountId: body.fundedAccountId.trim(),
        context,
      })
    } else {
      await declineFundedAccountForUser({
        userId: identity.internalUserId,
        notificationId: body.notificationId,
        masterAccountId: body.masterAccountId,
        reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : 'Other reason',
        context,
      })
    }
    return createSuccessResponse(
      { decision: body.decision },
      'Funded decision recorded',
      undefined,
      requestId,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process decision'
    const expected = message.includes('not found') || message.includes('No pending')
    if (!expected) {
      reportError(error, { surface: 'api', operation: 'record-funded-decision', route: request.nextUrl.pathname, requestId })
    }
    return createErrorResponse(
      expected ? message : 'Failed to process funded decision',
      expected ? 409 : 500,
      undefined,
      expected ? 'CONFLICT' : 'SERVER_ERROR',
      requestId,
    )
  }
}
