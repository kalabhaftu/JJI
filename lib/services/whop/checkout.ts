/**
 * lib/services/whop/checkout.ts
 *
 * Server-side checkout link construction for Whop card payments.
 *
 * Creates a checkout URL for a given plan by directing the user to the Whop
 * hosted checkout page. The internal user ID is passed as a metadata parameter
 * so the webhook handler can reconcile the purchase back to the JJI account.
 */

import { WHOP_CONFIG, whopClient, type WhopPlanKey } from './client'
import { logger } from '@/lib/logger'

export interface WhopCheckoutResult {
  /** The full Whop checkout URL to redirect the user to. */
  checkoutUrl: string
  /** The plan ID resolved for this checkout session. */
  planId: string
  /** Local idempotency key stored in sessionStorage to correlate the return. */
  referenceId: string
}

/**
 * Constructs a Whop checkout URL for the given plan.
 *
 * @param internalUserId The JJI `User.id` — embedded in the checkout
 *   as metadata for webhook reconciliation.
 * @param planKey        The plan key, e.g. `'pro'`.
 */
export async function createWhopCheckoutLink(
  internalUserId: string,
  planKey: WhopPlanKey,
): Promise<WhopCheckoutResult> {
  const rawPlanValue = WHOP_CONFIG.planIds[planKey]
  if (!rawPlanValue) {
    throw new Error(`[Whop] Unknown plan key: ${planKey}`)
  }

  const referenceId = `jji_${internalUserId}_${Date.now()}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.justjournalit.site'
  const redirectSuccessUrl = `${appUrl}/subscribe/success`

  // Extract clean plan_xxx if rawPlanValue is a URL
  let resolvedPlanId = rawPlanValue
  if (rawPlanValue.includes('checkout/')) {
    const parts = rawPlanValue.split('checkout/')[1].split('/')[0].split('?')[0]
    if (parts) resolvedPlanId = parts
  }

  // 1. Try creating official checkout session via Whop API to preserve metadata
  try {
    const session = await whopClient.checkoutConfigurations.create({
      plan_id: resolvedPlanId,
      metadata: {
        jji_user_id: internalUserId,
        jji_reference_id: referenceId,
      },
    } as any)

    const sessionUrl = (session as any)?.url || (session as any)?.purchase_url
    if (sessionUrl) {
      logger.info({ planKey, sessionId: (session as any).id }, '[WhopCheckout] Created dynamic checkout configuration session')
      return {
        checkoutUrl: sessionUrl,
        planId: resolvedPlanId,
        referenceId,
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, '[WhopCheckout] API checkout session creation failed, falling back to direct URL')
  }

  // 2. Fallback: Direct storefront / checkout URL
  let baseUrl = rawPlanValue
  if (!baseUrl.startsWith('http')) {
    baseUrl = `https://whop.com/checkout/${rawPlanValue}/`
  }

  const url = new URL(baseUrl)
  url.searchParams.set('d2c', '1')
  url.searchParams.set('metadata[jji_user_id]', internalUserId)
  url.searchParams.set('metadata[jji_reference_id]', referenceId)
  url.searchParams.set('redirect_url', redirectSuccessUrl)
  url.searchParams.set('success_url', redirectSuccessUrl)

  return {
    checkoutUrl: url.toString(),
    planId: resolvedPlanId,
    referenceId,
  }
}
