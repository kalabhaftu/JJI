import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { PaymentRecord, Subscription, User } from '@/lib/db/schema'
import logger from '@/lib/logger'
import { sendWelcomeEmail } from '../emails/welcome-email'

export interface WhopMembershipSnapshot {
  id: string
  status: string
  plan_id: string
  product_id?: string | null
  user_id?: string | null
  expires_at?: number | string | null
  cancel_at_period_end?: boolean
  renewal_period_start?: number | string | null
  renewal_period_end?: number | string | null
  metadata?: Record<string, unknown> | null
  quantity?: number
}

export type LocalSubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'expired'
  | 'cancelled'
  | 'free_access'
  | 'invited_free'
  | 'promo_active'

export function mapWhopStatusToLocal(
  whopStatus: string,
  cancelAtPeriodEnd: boolean,
): LocalSubscriptionStatus {
  switch (whopStatus) {
    case 'active':
      // Pending cancellation keeps access until period end — still 'active'.
      return 'active'
    case 'past_due':
    case 'incomplete':
      return 'past_due'
    case 'expired':
    case 'canceled':
    case 'cancelled':
    case 'trialing':
      return 'expired'
    default:
      logger.warn({ whopStatus }, '[WhopSync] Unmapped Whop membership status, treating as expired')
      return 'expired'
  }
}

export async function upsertWhopSubscription(
  membership: WhopMembershipSnapshot,
  internalUserId: string,
): Promise<void> {
  const localStatus = mapWhopStatusToLocal(
    membership.status,
    membership.cancel_at_period_end ?? false,
  )

  const parseWhopDate = (val: string | number | null | undefined): Date | null => {
    if (!val) return null
    if (typeof val === 'number') return new Date(val * 1000)
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }

  const periodStart = parseWhopDate(membership.renewal_period_start)
  const periodEnd = parseWhopDate(membership.expires_at) ?? parseWhopDate(membership.renewal_period_end)

  const cancelledAt =
    (membership.status === 'canceled' || membership.status === 'cancelled')
      ? new Date()
      : null

  let sub = await db.query.Subscription.findFirst({
    where: eq(Subscription.userId, internalUserId),
  })

  if (!sub) {
    const [newSub] = await db
      .insert(Subscription)
      .values({
        userId: internalUserId,
        status: localStatus,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextPaymentDue: periodEnd,
        cancelledAt,
        updatedAt: new Date(),
      })
      .returning()
    sub = newSub

    if (localStatus === 'active') {
      const user = await db.query.User.findFirst({
        where: eq(User.id, internalUserId)
      })
      if (user?.email) {
        sendWelcomeEmail(user.email, user.firstName).catch(err => {
          logger.error({ err, userId: internalUserId }, 'Failed to send welcome email')
        })
      }
    }
  } else {
    // Only update if the new status or dates are more recent.
    const isTerminal = ['expired', 'cancelled'].includes(localStatus)
    const wasActive = sub.status === 'active'

    // Preserve any NOWPayments-granted free access statuses.
    const isWhopManagedStatus = sub.status !== 'free_access' && sub.status !== 'invited_free' && sub.status !== 'promo_active'

    if (isWhopManagedStatus || isTerminal) {
      await db
        .update(Subscription)
        .set({
          status: localStatus,
          currentPeriodStart: periodStart ?? sub.currentPeriodStart,
          currentPeriodEnd: periodEnd ?? sub.currentPeriodEnd,
          nextPaymentDue: periodEnd ?? sub.nextPaymentDue,
          cancelledAt: cancelledAt ?? sub.cancelledAt,
          updatedAt: new Date(),
        })
        .where(eq(Subscription.id, sub.id))

      if (!wasActive && localStatus === 'active') {
        const user = await db.query.User.findFirst({
          where: eq(User.id, internalUserId)
        })
        if (user?.email) {
          sendWelcomeEmail(user.email, user.firstName).catch(err => {
            logger.error({ err, userId: internalUserId }, 'Failed to send welcome email')
          })
        }
      }
    }
  }

  const existingRecord = await db.query.PaymentRecord.findFirst({
    where: and(
      eq(PaymentRecord.userId, internalUserId),
      eq(PaymentRecord.whopMembershipId, membership.id),
    ),
  })

  const priceUsd = Number(process.env.SUBSCRIPTION_PRICE_USD || '10')

  const recordData = {
    userId: internalUserId,
    subscriptionId: sub!.id,
    provider: 'whop' as const,
    whopMembershipId: membership.id,
    whopUserId: membership.user_id ?? null,
    whopPlanId: membership.plan_id,
    whopProductId: membership.product_id ?? null,
    whopEnvironment: process.env.WHOP_ENVIRONMENT ?? 'sandbox',
    amountUsd: priceUsd,
    providerStatus: membership.status,
    subscriptionPeriodStart: periodStart,
    subscriptionPeriodEnd: periodEnd,
    paidAt: membership.status === 'active' ? (periodStart ?? new Date()) : null,
    updatedAt: new Date(),
  }

  if (existingRecord) {
    await db
      .update(PaymentRecord)
      .set(recordData)
      .where(eq(PaymentRecord.id, existingRecord.id))
  } else {
    await db.insert(PaymentRecord).values(recordData)
  }

  logger.info(
    {
      membershipId: membership.id,
      internalUserId,
      localStatus,
    },
    '[WhopSync] Upserted membership',
  )
}
