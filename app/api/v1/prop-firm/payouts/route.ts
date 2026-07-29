/**
 * Payout Management API
 * POST /api/prop-firm/payouts - Request a new payout
 * DELETE /api/prop-firm/payouts/[id] - Delete a pending payout
 */

import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import { savePayoutForUser } from '@/server/accounts/payouts'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { isDomainError } from '@/lib/domain-error'

export async function POST(request: NextRequest) {
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
    const body = await request.json()
    const { masterAccountId, phaseAccountId, amount, notes } = body

    if (!masterAccountId || !phaseAccountId || amount === undefined || amount === null || amount === '') {
      return createErrorResponse(
        'Missing required fields: masterAccountId, phaseAccountId, and amount',
        400,
        undefined,
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return createErrorResponse(
        'Amount must be a positive number',
        400,
        undefined,
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const result = await savePayoutForUser(identity.internalUserId, {
      masterAccountId,
      phaseAccountId,
      amount: numericAmount,
      ...(notes ? { notes: String(notes) } : {}),
    }, {
      source: 'api',
      requestId,
      ipAddress: getClientIp(request.headers),
    })

    return createSuccessResponse(
      result.data,
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
      operation: 'create-payout',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to create payout',
      500,
      undefined,
      'PAYOUT_CREATE_FAILED',
      requestId,
    )
  }
}
