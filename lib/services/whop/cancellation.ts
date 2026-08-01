import 'server-only'

import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { WhopMembership } from '@/lib/db/schema'
import { cancelWhopMembershipAtPeriodEnd } from '@/lib/services/whop/client'
import { getWhopEnvironment } from '@/lib/services/whop/config'
import { syncWhopMembership } from '@/lib/services/whop/membership-sync'

export class WhopMembershipNotFoundError extends Error {
  constructor() {
    super('No active card subscription was found.')
    this.name = 'WhopMembershipNotFoundError'
  }
}

export async function cancelOwnedWhopMembershipAtPeriodEnd(input: {
  userId: string
  requestId: string
}) {
  const membership = await db.query.WhopMembership.findFirst({
    where: and(
      eq(WhopMembership.userId, input.userId),
      eq(WhopMembership.environment, getWhopEnvironment()),
    ),
    orderBy: [desc(WhopMembership.updatedAt)],
  })

  if (!membership) throw new WhopMembershipNotFoundError()

  if (membership.cancelAtPeriodEnd) {
    return membership
  }

  const providerMembership = await cancelWhopMembershipAtPeriodEnd(membership.membershipId)
  const synced = await syncWhopMembership(providerMembership, { requestId: input.requestId })
  return synced.storedMembership
}
