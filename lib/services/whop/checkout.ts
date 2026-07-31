/**
 * lib/services/whop/checkout.ts
 *
 * Server-side checkout link construction for Whop card payments.
 *
 * Creates a checkout URL for a given plan by directing the user to the Whop
 * hosted checkout page. The internal user ID is passed as a metadata parameter
 * so the webhook handler can reconcile the purchase back to the JJI account
 * without relying on client-supplied data.
 *
 * The metadata binding is the ONLY trusted link between a Whop membership and
 * an internal user. The query parameter is for UX only (e.g. pre-filled email)
 * and is never used as a trusted source of truth for access grants.
 */

import { WHOP_CONFIG, type WhopPlanKey } from './client'

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
 *   as a `metadata[jji_user_id]` parameter for webhook reconciliation.
 * @param planKey        The plan key, e.g. `'pro'`.
 */
export async function createWhopCheckoutLink(
  internalUserId: string,
  planKey: WhopPlanKey,
): Promise<WhopCheckoutResult> {
  const planId = WHOP_CONFIG.planIds[planKey]
  if (!planId) {
    throw new Error(`[Whop] Unknown plan key: ${planKey}`)
  }

  const referenceId = `jji_${internalUserId}_${Date.now()}`

  // Build the Whop checkout URL.
  // Whop checkout URLs follow the pattern: https://whop.com/checkout/<plan_id>/
  // We append the internal user ID as a query parameter which Whop passes
  // through to the checkout page metadata so the webhook can identify the user.
  const url = new URL(`https://whop.com/checkout/${planId}/`)
  url.searchParams.set('d2c', '1')
  url.searchParams.set('metadata[jji_user_id]', internalUserId)
  url.searchParams.set('metadata[jji_reference_id]', referenceId)

  return {
    checkoutUrl: url.toString(),
    planId,
    referenceId,
  }
}
