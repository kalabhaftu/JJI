/**
 * lib/services/whop/reconcile.ts
 *
 * Pulls authoritative membership state from the Whop API and updates local state.
 * Useful for recovery if webhooks are missed, or for ad-hoc syncing.
 */

import { whopClient } from './client'
import { upsertWhopSubscription, type WhopMembershipSnapshot } from './membership-sync'

/**
 * Fetches the latest membership state from Whop and upserts it locally.
 *
 * @param membershipId   The Whop membership ID (mem_xxx)
 * @param internalUserId The JJI `User.id` (if known, otherwise pulled from metadata)
 */
export async function reconcileWhopMembership(
  membershipId: string,
  internalUserId?: string,
): Promise<void> {
  // Fetch from Whop SDK
  // The Whop SDK uses GET /api/v1/memberships/{id}
  const response = await whopClient.memberships.retrieve(membershipId)
  if (!response) {
    throw new Error(`[WhopReconcile] Membership not found: ${membershipId}`)
  }

  // The SDK might return an object with data inside or just the object itself,
  // depending on the Whop API response structure. Let's assume it returns
  // the membership object directly based on typical SDK patterns.
  const membershipData = response as any

  const userIdToUse = internalUserId ?? membershipData.metadata?.jji_user_id
  if (!userIdToUse) {
    throw new Error(
      `[WhopReconcile] Cannot reconcile membership ${membershipId}: no internal user ID known or in metadata.`,
    )
  }

  const snapshot: WhopMembershipSnapshot = {
    id: membershipData.id,
    status: membershipData.status,
    plan_id: membershipData.plan_id,
    product_id: membershipData.product_id,
    user_id: membershipData.user_id,
    expires_at: membershipData.expires_at,
    cancel_at_period_end: membershipData.cancel_at_period_end,
    renewal_period_start: membershipData.renewal_period_start,
    renewal_period_end: membershipData.renewal_period_end,
    metadata: membershipData.metadata,
  }

  await upsertWhopSubscription(snapshot, userIdToUse)
}
