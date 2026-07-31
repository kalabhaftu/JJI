import { whopClient } from './client'
import { upsertWhopSubscription, type WhopMembershipSnapshot } from './membership-sync'

export async function reconcileWhopMembership(
  membershipId: string,
  internalUserId?: string,
): Promise<void> {
  const response = await whopClient.memberships.retrieve(membershipId)
  if (!response) {
    throw new Error(`[WhopReconcile] Membership not found: ${membershipId}`)
  }

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
