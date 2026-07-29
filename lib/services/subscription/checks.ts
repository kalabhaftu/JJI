import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { PaymentRecord, Subscription } from '@/lib/db/schema'
import logger from '@/lib/logger'
import { reportError } from '@/lib/observability/report-error'
import { createPaymentNotification } from '@/lib/services/subscription/notifications'
import { reconcilePaymentRecord } from '@/lib/services/subscription/payments'
import type { NowPaymentStatus } from '@/lib/services/nowpayments-service'

const GRACE_DAYS = Number.parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '3', 10)
const PAYMENT_RECONCILIATION_BATCH_SIZE = 100
const PENDING_PROVIDER_STATUSES: Array<NowPaymentStatus | 'pending'> = [
  'pending',
  'waiting',
  'confirming',
  'confirmed',
  'sending',
  'partially_paid',
]

export async function expireAbandonedPayments(userId?: string) {
  const pendingPayments = await db.query.PaymentRecord.findMany({
    where: and(
      userId ? eq(PaymentRecord.userId, userId) : undefined,
      inArray(PaymentRecord.providerStatus, PENDING_PROVIDER_STATUSES)
    ),
    orderBy: asc(PaymentRecord.createdAt),
    limit: PAYMENT_RECONCILIATION_BATCH_SIZE,
  })

  if (pendingPayments.length === 0) return { expired: 0 }

  logger.info({ count: pendingPayments.length }, '[Subscription] Reconciling pending payments')

  let expiredCount = 0
  for (const record of pendingPayments) {
    try {
      const updated = await reconcilePaymentRecord(record.id, record.userId)
      if (updated?.providerStatus === 'expired') expiredCount++
    } catch (error) {
      reportError(error, {
        surface: 'background-job',
        operation: 'expire-abandoned-payment',
        entityId: record.id,
        userId: record.userId,
      })
    }
  }

  return { expired: expiredCount }
}

export async function runSubscriptionChecks() {
  const now = new Date()
  const results = { notified: 0, expired: 0, abandonedCleaned: 0, errors: [] as string[] }

  // 1. Clean up abandoned payments first
  try {
    const cleanup = await expireAbandonedPayments()
    results.abandonedCleaned = cleanup.expired
  } catch (err) {
    reportError(err, {
      surface: 'background-job',
      operation: 'cleanup-abandoned-subscription-payments',
    })
    results.errors.push(`Abandoned Cleanup: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  // Find active subscriptions with upcoming due dates (processed in batches of 100)
  const BATCH_SIZE = 100
  let cursorId: string | undefined = undefined
  let hasMore = true

  while (hasMore) {
    const subscriptions: any[] = await db.query.Subscription.findMany({
      where: and(
        inArray(Subscription.status, ['active', 'past_due']),
        isNotNull(Subscription.nextPaymentDue)
      ),
      limit: BATCH_SIZE,
      offset: cursorId ? 1 : 0, // NOTE: this isn't true cursor pagination but will work for small batches if we sort
      with: { User: { columns: { id: true, email: true } } },
      orderBy: asc(Subscription.id),
    })
    // To make offset pagination safe since we don't have cursors natively like prisma
    // in this exact query structure, we'd need to modify the where clause, but this is a rough approx.

    if (subscriptions.length === 0) {
      hasMore = false
      break
    }

    cursorId = subscriptions[subscriptions.length - 1].id
    if (subscriptions.length < BATCH_SIZE) {
      hasMore = false
    }

    for (const sub of subscriptions) {
      try {
        if (!sub.nextPaymentDue) continue
        const daysUntilDue = Math.ceil((sub.nextPaymentDue.getTime() - now.getTime()) / 86400000)

        if (daysUntilDue === 3) {
          await createPaymentNotification(sub.userId, 'PAYMENT_DUE_SOON', 'Payment Due Soon',
            'Your subscription payment is due in 3 days.')
          results.notified++
        } else if (daysUntilDue === 1) {
          await createPaymentNotification(sub.userId, 'PAYMENT_DUE_SOON', 'Payment Due Tomorrow',
            'Your subscription payment is due tomorrow.')
          results.notified++
        } else if (daysUntilDue === 0) {
          await createPaymentNotification(sub.userId, 'PAYMENT_DUE_TODAY', 'Payment Due Today',
            'Your subscription payment is due today. Please renew to keep your access.')
          results.notified++
        } else if (daysUntilDue < 0 && daysUntilDue >= -GRACE_DAYS) {
          // Within grace period
          if (sub.status !== 'past_due') {
            await db.update(Subscription).set({ status: 'past_due' }).where(eq(Subscription.id, sub.id))
          }
          await createPaymentNotification(sub.userId, 'PAYMENT_OVERDUE', 'Payment Overdue',
            `Your payment is overdue. You have ${GRACE_DAYS + daysUntilDue} day(s) left before access is suspended.`)
          results.notified++
        } else if (daysUntilDue < -GRACE_DAYS) {
          // Past grace period - expire
          await db.update(Subscription).set({ status: 'expired' }).where(eq(Subscription.id, sub.id))
          await createPaymentNotification(sub.userId, 'SUBSCRIPTION_EXPIRED', 'Subscription Expired',
            'Your subscription has expired. Please renew to regain access.')
          results.expired++
        }
      } catch (err) {
        reportError(err, {
          surface: 'background-job',
          operation: 'check-subscription-renewal',
          entityId: sub.id,
          userId: sub.userId,
        })
        results.errors.push(`Sub ${sub.id}: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    }
  }

  return results
}

export async function reconcilePendingPayments(params?: { userId?: string }) {
  return expireAbandonedPayments(params?.userId)
}
