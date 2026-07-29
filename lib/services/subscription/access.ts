import { eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { FreeAccessInvite, Subscription, User } from '@/lib/db/schema'
import { reconcilePendingPayments } from '@/lib/services/subscription/checks'
import type { SubscriptionStatus } from '@/lib/services/subscription/types'

const GRACE_DAYS = Number.parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '3', 10)

export interface AccessResult {
  hasAccess: boolean
  status: SubscriptionStatus | 'no_subscription' | 'admin'
  subscription: any | null
  reason?: string
}

export async function getUserAccessStatus(userId: string, userRole?: string): Promise<AccessResult> {
  if (userRole === 'admin') {
    return { hasAccess: true, status: 'admin' as any, subscription: null }
  }

  const subscription = await db.query.Subscription.findFirst({
    where: eq(Subscription.userId, userId),
    with: { FreeAccess: true },
  })

  if (!subscription) {
    // Check if there's a free access invite for this user
    const user = await db.query.User.findFirst({ where: eq(User.id, userId), columns: { email: true } })
    if (user) {
      const freeAccess = await db.query.FreeAccessInvite.findFirst({
        where: eq(FreeAccessInvite.email, user.email!),
      })
      if (freeAccess?.isActive) {
        // Auto-create subscription record for free access
        const [sub] = await db.insert(Subscription).values({
            userId,
            status: freeAccess.type === 'lifetime' ? 'free_access' : 'invited_free',
            freeAccessId: freeAccess.id,
            currentPeriodStart: new Date(),
            currentPeriodEnd: freeAccess.expiresAt || null,
            updatedAt: new Date(),
          }).returning()
        await db.update(FreeAccessInvite)
          .set({ registeredAt: new Date(), registeredUserId: userId })
          .where(eq(FreeAccessInvite.id, freeAccess.id))
        return { hasAccess: true, status: sub?.status as any, subscription: sub as any }
      }
    }
    return { hasAccess: false, status: 'no_subscription' as any, subscription: null, reason: 'No subscription found' }
  }

  const activeStatuses: SubscriptionStatus[] = ['active', 'free_access', 'invited_free', 'promo_active']
  if (activeStatuses.includes(subscription.status as SubscriptionStatus)) {
    if (
      (subscription.status === 'invited_free' || subscription.status === 'free_access') &&
      subscription.FreeAccess &&
      !subscription.FreeAccess.isActive
    ) {
      const [updated] = await db.update(Subscription)
        .set({ status: 'expired' })
        .where(eq(Subscription.id, subscription.id))
        .returning()
      return { hasAccess: false, status: 'expired', subscription: updated, reason: 'Free access revoked' }
    }

    // Check if free access has expired
    if (
      (subscription.status === 'invited_free' || subscription.status === 'free_access') &&
      subscription.currentPeriodEnd &&
      new Date() > subscription.currentPeriodEnd
    ) {
      await db.update(Subscription)
        .set({ status: 'expired' })
        .where(eq(Subscription.id, subscription.id))
      return { hasAccess: false, status: 'expired', subscription, reason: 'Free access expired' }
    }
    return { hasAccess: true, status: subscription.status as string, subscription }
  }

  // Handle active "waiting" payments that might be expired
  if (subscription.status === 'unpaid' || subscription.status === 'past_due') {
    await reconcilePendingPayments({ userId })
  }

  // past_due: within grace period, still allow access
  if (subscription.status === 'past_due') {
    const graceCutoff = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd.getTime() + GRACE_DAYS * 86400000)
      : null
    if (graceCutoff && new Date() <= graceCutoff) {
      return { hasAccess: true, status: 'past_due', subscription, reason: 'Grace period' }
    }
    // Past grace period
    await db.update(Subscription)
        .set({ status: 'expired' })
        .where(eq(Subscription.id, subscription.id))
    return { hasAccess: false, status: 'expired', subscription, reason: 'Grace period expired' }
  }

  return { hasAccess: false, status: subscription.status as string, subscription, reason: `Status: ${subscription.status}` }
}
