/**
 * POST /api/v1/payments/create-invoice
 * Creates a NOWPayments invoice for the authenticated user's subscription.
 */

import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createSubscriptionInvoice, validatePromoCode } from '@/lib/services/subscription-service'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

function paymentRedirectUrl(request: NextRequest, paymentRecordId?: string | null) {
  if (!paymentRecordId) return null
  return new URL(`/api/v1/payments/redirect?paymentRecordId=${encodeURIComponent(paymentRecordId)}`, request.url).toString()
}

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
    const { promoCode, payCurrency } = body as { promoCode?: string; payCurrency?: string }

    // Validate promo code first if provided
    if (promoCode) {
      const promo = await validatePromoCode(promoCode, identity.internalUserId)
      if (!promo) {
        return createErrorResponse('Invalid or expired promo code', 400, undefined, 'INVALID_PROMO_CODE', requestId)
      }
    }

    const result = await createSubscriptionInvoice(identity.internalUserId, {
      ...(promoCode ? { promoCode } : {}),
      ...(payCurrency ? { payCurrency } : {})
    })

    if (result.alreadyActive) {
      return createErrorResponse('Subscription already active', 409, undefined, 'SUBSCRIPTION_ACTIVE', requestId)
    }

    if (result.freeAccess) {
      return createSuccessResponse(
        { freeAccess: true },
        'Access granted! Redirecting to dashboard...',
        undefined,
        requestId,
      )
    }

    const paymentUrl = paymentRedirectUrl(request, result.paymentRecordId)

    return createSuccessResponse({
      invoiceUrl: paymentUrl,
      paymentUrl,
      invoiceId: result.invoiceId,
      paymentRecordId: result.paymentRecordId,
      expiresAt: result.expiresAt,
      reusedExisting: Boolean(result.reusedExisting),
    }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'create-payment-invoice', route: request.nextUrl.pathname, requestId })
    return createErrorResponse(
      'Failed to create payment invoice',
      500,
      undefined,
      'PAYMENT_INVOICE_FAILED',
      requestId,
    )
  }
}
