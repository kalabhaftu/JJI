import 'server-only'

import { eq } from 'drizzle-orm'
import type { Membership } from '@whop/sdk/resources'

import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import { Subscription, User, WhopMembership } from '@/lib/db/schema'
import { getWhopClient } from '@/lib/services/whop/client'
import { getWhopEnvironment } from '@/lib/services/whop/config'
import {
  notifyWhopMembershipStatus,
  sendWhopWelcomeEmail,
} from '@/lib/services/whop/notifications'
import { mapWhopStatusToLocal, type LocalWhopStatus } from '@/lib/services/whop/status'

const SPECIAL_ACCESS_STATUSES = new Set(['free_access', 'invited_free', 'promo_active'])
type SpecialAccessStatus = 'free_access' | 'invited_free' | 'promo_active'
type PersistedSubscriptionStatus = LocalWhopStatus | SpecialAccessStatus

function parseProviderDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function metadataUserId(membership: Membership): string | null {
  const value = membership.metadata?.jji_user_id
  return typeof value === 'string' && value.length > 0 ? value : null
}

async function resolveInternalUserId(membership: Membership): Promise<string> {
  const metadataId = metadataUserId(membership)
  if (metadataId) {
    const user = await db.query.User.findFirst({
      where: eq(User.id, metadataId),
      columns: { id: true },
    })
    if (user) return user.id
  }

  const existing = await db.query.WhopMembership.findFirst({
    where: eq(WhopMembership.membershipId, membership.id),
    columns: { userId: true },
  })
  if (existing) return existing.userId

  throw new Error('Whop membership cannot be mapped to a JJI user')
}

function isSpecialAccessStatus(value: string): value is SpecialAccessStatus {
  return SPECIAL_ACCESS_STATUSES.has(value)
}

function statusToPersist(
  currentStatus: string | null,
  whopStatus: LocalWhopStatus,
): PersistedSubscriptionStatus {
  if (whopStatus === 'active') return whopStatus
  if (currentStatus && isSpecialAccessStatus(currentStatus)) return currentStatus
  return whopStatus
}

export async function syncWhopMembership(
  membership: Membership,
  context: { requestId?: string } = {},
) {
  const internalUserId = await resolveInternalUserId(membership)
  const mappedStatus = mapWhopStatusToLocal(membership.status)
  const periodStart = parseProviderDate(membership.renewal_period_start)
  const periodEnd = parseProviderDate(membership.renewal_period_end)
  const cancelledAt = parseProviderDate(membership.canceled_at)
  const providerUpdatedAt = parseProviderDate(membership.updated_at)

  const result = await db.transaction(async (tx) => {
    const current = await tx.query.Subscription.findFirst({
      where: eq(Subscription.userId, internalUserId),
    })
    const previousStatus = current?.status ?? null
    const storedStatus = statusToPersist(previousStatus, mappedStatus)

    let subscription = current
    if (!subscription) {
      const [created] = await tx.insert(Subscription).values({
        userId: internalUserId,
        status: storedStatus,
        planId: 'pro',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextPaymentDue: periodEnd,
        cancelledAt,
        updatedAt: new Date(),
      }).returning()
      if (!created) throw new Error('Failed to create subscription for Whop membership')
      subscription = created
    } else {
      const [updated] = await tx.update(Subscription).set({
        status: storedStatus,
        currentPeriodStart: periodStart ?? subscription.currentPeriodStart,
        currentPeriodEnd: periodEnd ?? subscription.currentPeriodEnd,
        nextPaymentDue: periodEnd ?? subscription.nextPaymentDue,
        cancelledAt,
        updatedAt: new Date(),
      }).where(eq(Subscription.id, subscription.id)).returning()
      if (!updated) throw new Error('Failed to update subscription from Whop membership')
      subscription = updated
    }

    const [storedMembership] = await tx.insert(WhopMembership).values({
      userId: internalUserId,
      subscriptionId: subscription.id,
      membershipId: membership.id,
      whopUserId: membership.user?.id ?? null,
      planId: membership.plan.id,
      productId: membership.product.id,
      environment: getWhopEnvironment(),
      status: membership.status,
      cancelAtPeriodEnd: membership.cancel_at_period_end,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      manageUrl: membership.manage_url,
      providerUpdatedAt,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: WhopMembership.membershipId,
      set: {
        userId: internalUserId,
        subscriptionId: subscription.id,
        whopUserId: membership.user?.id ?? null,
        planId: membership.plan.id,
        productId: membership.product.id,
        environment: getWhopEnvironment(),
        status: membership.status,
        cancelAtPeriodEnd: membership.cancel_at_period_end,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        manageUrl: membership.manage_url,
        providerUpdatedAt,
        updatedAt: new Date(),
      },
    }).returning()
    if (!storedMembership) throw new Error('Failed to persist Whop membership')

    await recordAuditEvent({
      userId: internalUserId,
      action: 'WHOP_MEMBERSHIP_SYNCED',
      entityType: 'WhopMembership',
      entityId: membership.id,
      source: 'background-job',
      requestId: context.requestId ?? null,
      beforeData: { status: previousStatus },
      afterData: {
        status: storedStatus,
        providerStatus: membership.status,
        cancelAtPeriodEnd: membership.cancel_at_period_end,
        currentPeriodEnd: periodEnd,
      },
    }, tx as never)

    const user = await tx.query.User.findFirst({
      where: eq(User.id, internalUserId),
      columns: { email: true, firstName: true },
    })

    return {
      internalUserId,
      subscription,
      storedMembership,
      previousStatus,
      storedStatus,
      user,
    }
  })

  await notifyWhopMembershipStatus({
    userId: result.internalUserId,
    membershipId: membership.id,
    previousStatus: result.previousStatus,
    status: result.storedStatus,
  })

  if (result.previousStatus !== 'active' && result.storedStatus === 'active' && result.user?.email) {
    await sendWhopWelcomeEmail({
      email: result.user.email,
      firstName: result.user.firstName,
      membershipId: membership.id,
      ...(context.requestId ? { requestId: context.requestId } : {}),
    })
  }

  return result
}

export async function reconcileWhopMembership(
  membershipId: string,
  context: { requestId?: string } = {},
) {
  const membership = await getWhopClient().memberships.retrieve(membershipId)
  return syncWhopMembership(membership, context)
}
