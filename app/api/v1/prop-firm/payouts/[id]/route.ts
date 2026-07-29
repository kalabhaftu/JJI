/**
 * Payout Management API
 * DELETE /api/prop-firm/payouts/[id] - Delete a pending payout
 */

import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import { deletePayoutForUser } from '@/server/accounts/payouts'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { isDomainError } from '@/lib/domain-error'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'payment')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse(
        'Unauthorized',
        401,
        undefined,
        'UNAUTHORIZED',
        requestId,
      )
    }
    const { id: payoutId } = await params

    if (!payoutId) {
      return createErrorResponse(
        'Payout ID is required',
        400,
        undefined,
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const result = await deletePayoutForUser(
      identity.internalUserId,
      payoutId,
      {
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
      },
    )

    return createSuccessResponse(
      { deleted: true },
      result.message,
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
      operation: 'delete-payout',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to delete payout',
      500,
      undefined,
      'PAYOUT_DELETE_FAILED',
      requestId,
    )
  }
}
