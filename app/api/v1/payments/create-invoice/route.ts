/**
 * POST /api/v1/payments/create-invoice
 * Creates a NOWPayments invoice for the authenticated user's subscription.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { createSubscriptionInvoice, validatePromoCode } from '@/lib/services/subscription-service'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { promoCode, payCurrency } = body as { promoCode?: string; payCurrency?: string }

    // Validate promo code first if provided
    if (promoCode) {
      const promo = await validatePromoCode(promoCode, identity.internalUserId)
      if (!promo) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired promo code' },
          { status: 400 }
        )
      }
    }

    const result = await createSubscriptionInvoice(identity.internalUserId, {
      ...(promoCode ? { promoCode } : {}),
      ...(payCurrency ? { payCurrency } : {})
    })

    if (result.alreadyActive) {
      return NextResponse.json({
        success: false,
        error: 'Subscription already active',
      }, { status: 409 })
    }

    if (result.freeAccess) {
      return NextResponse.json({
        success: true,
        freeAccess: true,
        message: 'Access granted! Redirecting to dashboard...',
      })
    }

    return NextResponse.json({
      success: true,
      invoiceUrl: result.invoiceUrl,
      invoiceId: result.invoiceId,
      paymentRecordId: result.paymentRecordId,
      reusedExisting: Boolean(result.reusedExisting),
    })
  } catch (error) {
    logger.error({ error, context: 'Payment Create Invoice' }, 'Create invoice failed')
    return NextResponse.json(
      { success: false, error: 'Failed to create payment invoice' },
      { status: 500 }
    )
  }
}
