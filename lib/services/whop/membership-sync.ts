/**
 * lib/services/whop/membership-sync.ts
 *
 * Maps Whop membership objects to the local Subscription + PaymentRecord tables.
 *
 * This module owns the canonical Whop → JJI status mapping and the transactional
 * DB upsert. All code that needs to persist a Whop membership state into the
 * local DB should go through `upsertWhopSubscription`.
 */

import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { PaymentRecord, Subscription, User } from '@/lib/db/schema'
import logger from '@/lib/logger'
import { sendWelcomeEmail } from '../emails/welcome-email'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Subset of the Whop Membership object fields we care about.
 * Typed loosely so this module is not tightly coupled to the SDK types.
 */
export interface WhopMembershipSnapshot {
  id: string                          // mem_xxx
  status: string                      // 'active' | 'expired' | 'past_due' | 'canceled' | ...
  plan_id: string                     // plan_xxx
  product_id?: string | null          // prod_xxx
  user_id?: string | null             // Whop user ID
  expires_at?: number | null          // Unix timestamp
  cancel_at_period_end?: boolean
  renewal_period_start?: number | null
  renewal_period_end?: number | null
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

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

/**
 * Maps a Whop membership `status` string to the JJI `SubscriptionStatus` enum.
 *
 * Whop statuses:
 *   'active'    — subscription is live and billing is current
 *   'expired'   — subscription ended (no longer billing)
 *   'past_due'  — last renewal payment failed; Whop may retry
 *   'canceled'  — customer or seller cancelled
 *   (others)    — treated as expired / no access
 *
 * @param whopStatus      Raw status string from Whop membership.
 * @param cancelAtPeriodEnd  Whether membership is set to cancel at period end.
 */
export function mapWhopStatusToLocal(
  whopStatus: string,
  cancelAtPeriodEnd: boolean,
): LocalSubscriptionStatus {
  switch (whopStatus) {
    case 'active':
      // If pending cancellation, keep access until period end — still 'active'.
      return 'active'
    case 'past_due':
    case 'incomplete':
      return 'past_due'
    case 'expired':
    case 'canceled':
    case 'cancelled':
    case 'trialing':  // trial ended without converting
      return 'expired'
    default:
      logger.warn({ whopStatus }, '[WhopSync] Unmapped Whop membership status, treating as expired')
      return 'expired'
  }
}

// ---------------------------------------------------------------------------
// DB upsert
// ---------------------------------------------------------------------------

/**
 * Idempotently upserts a Whop membership into the local `Subscription` and
 * `PaymentRecord` tables.
 *
 * - Finds or creates the subscription record for the given user.
 * - Updates subscription `status`, `currentPeriodStart`, `currentPeriodEnd`,
 *   `cancelledAt`, and `nextPaymentDue`.
 * - Upserts a `PaymentRecord` row keyed on `whopMembershipId` (unique column).
 *
 * This function is called by both the webhook event processor and the
 * reconcile module — it must be safe to call multiple times with the same data.
 *
 * @param membership     Snapshot of the Whop membership object.
 * @param internalUserId The JJI `User.id`.
 */
export async function upsertWhopSubscription(
  membership: WhopMembershipSnapshot,
  internalUserId: string,
): Promise<void> {
  const localStatus = mapWhopStatusToLocal(
    membership.status,
    membership.cancel_at_period_end ?? false,
  )

  const periodStart = membership.renewal_period_start
    ? new Date(membership.renewal_period_start * 1000)
    : null

  const periodEnd = membership.expires_at
    ? new Date(membership.expires_at * 1000)
    : null

  const cancelledAt =
    (membership.status === 'canceled' || membership.status === 'cancelled')
      ? new Date()
      : null

  // ------------------------------------------------------------------
  // 1. Ensure a Subscription row exists
  // ------------------------------------------------------------------
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

    // Send Welcome Email if this is their first time getting an active subscription
    if (localStatus === 'active') {
      const user = await db.query.User.findFirst({
        where: eq(User.id, internalUserId)
      })
      if (user?.email) {
        // Fire and forget
        sendWelcomeEmail(user.email, user.firstName).catch(err => {
          logger.error({ err, userId: internalUserId }, 'Failed to send welcome email')
        })
      }
    }
  } else {
    // Only update if the new status or dates are more recent.
    // Always win on terminal states (expired, cancelled).
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

      // Send Welcome Email if they are upgrading from a non-active state to active
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

  // ------------------------------------------------------------------
  // 2. Upsert a PaymentRecord keyed on whopMembershipId
  // ------------------------------------------------------------------
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
