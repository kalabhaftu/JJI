

import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { validatePromoCode } from '@/lib/services/subscription-service'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'payment')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const body = await request.json().catch(() => ({}))
    const { code } = body as { code?: string }
    if (!code || typeof code !== 'string') {
      return createErrorResponse('Promo code is required', 400, undefined, 'PROMO_CODE_REQUIRED', requestId)
    }

    const promo = await validatePromoCode(code.trim().toUpperCase(), identity.internalUserId)
    if (!promo) {
      return createErrorResponse('Invalid or expired promo code', 400, undefined, 'INVALID_PROMO_CODE', requestId)
    }

    return createSuccessResponse(
      { code: promo.code, discountDescription: promo.discountDescription },
      undefined,
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'validate-promo-code', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to validate promo code', 500, undefined, 'PROMO_VALIDATION_FAILED', requestId)
  }
}
