import 'server-only'

import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { WhopWebhookEvent } from '@/lib/db/schema'
import { reportError } from '@/lib/observability/report-error'
import { reconcileWhopMembership } from '@/lib/services/whop/membership-sync'
import {
  reconcileWhopPayment,
  reconcileWhopRefund,
} from '@/lib/services/whop/payment-sync'

const MEMBERSHIP_EVENTS = new Set([
  'membership.activated',
  'membership.deactivated',
  'membership.cancel_at_period_end_changed',
  'membership.trial_ending_soon',
])
const PAYMENT_EVENTS = new Set([
  'payment.created',
  'payment.pending',
  'payment.failed',
  'payment.succeeded',
])
const REFUND_EVENTS = new Set(['refund.created', 'refund.updated'])

function safeErrorCode(error: unknown): string {
  return error instanceof Error
    ? error.name.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 100)
    : 'UnknownError'
}

export async function processWhopWebhookEvent(
  eventId: string,
  fallbackRequestId?: string,
) {
  const workerToken = crypto.randomUUID()
  const now = new Date()
  const leaseExpiresAt = new Date(now.getTime() + 5 * 60_000)
  const [claimed] = await db.update(WhopWebhookEvent).set({
    status: 'processing',
    workerToken,
    leaseExpiresAt,
    attemptCount: sql`${WhopWebhookEvent.attemptCount} + 1`,
    updatedAt: now,
  }).where(and(
    eq(WhopWebhookEvent.eventId, eventId),
    or(
      inArray(WhopWebhookEvent.status, ['received', 'queued', 'failed']),
      and(
        eq(WhopWebhookEvent.status, 'processing'),
        or(
          isNull(WhopWebhookEvent.leaseExpiresAt),
          lt(WhopWebhookEvent.leaseExpiresAt, now),
        ),
      ),
    ),
  )).returning()

  if (!claimed) {
    const existing = await db.query.WhopWebhookEvent.findFirst({
      where: eq(WhopWebhookEvent.eventId, eventId),
    })
    return { skipped: true, status: existing?.status ?? 'missing' }
  }

  const requestId = claimed.requestId ?? fallbackRequestId
  let finalStatus = 'processed'

  try {
    if (MEMBERSHIP_EVENTS.has(claimed.eventType)) {
      if (!claimed.resourceId) throw new Error('Whop membership event is missing a resource ID')
      await reconcileWhopMembership(claimed.resourceId, requestId ? { requestId } : {})
    } else if (PAYMENT_EVENTS.has(claimed.eventType)) {
      if (!claimed.resourceId) throw new Error('Whop payment event is missing a resource ID')
      await reconcileWhopPayment(claimed.resourceId, requestId ? { requestId } : {})
    } else if (REFUND_EVENTS.has(claimed.eventType)) {
      if (!claimed.resourceId) throw new Error('Whop refund event is missing a resource ID')
      await reconcileWhopRefund(claimed.resourceId, requestId ? { requestId } : {})
    } else if (claimed.reviewRequired) {
      reportError(new Error('Whop billing event requires manual review'), {
        surface: 'background-job',
        operation: 'whop-billing-manual-review',
        ...(requestId ? { requestId } : {}),
        entityId: claimed.eventId,
        level: 'warning',
        tags: {
          provider: 'whop',
          eventType: claimed.eventType,
          resourceId: claimed.resourceId,
        },
      })
    } else {
      finalStatus = 'ignored'
    }

    await db.update(WhopWebhookEvent).set({
      status: finalStatus,
      processedAt: new Date(),
      lastErrorCode: null,
      workerToken: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(WhopWebhookEvent.eventId, eventId),
      eq(WhopWebhookEvent.workerToken, workerToken),
    ))

    return { skipped: false, status: finalStatus }
  } catch (error) {
    await db.update(WhopWebhookEvent).set({
      status: 'failed',
      lastErrorCode: safeErrorCode(error),
      workerToken: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(WhopWebhookEvent.eventId, eventId),
      eq(WhopWebhookEvent.workerToken, workerToken),
    ))
    reportError(error, {
      surface: 'background-job',
      operation: 'process-whop-webhook',
      ...(requestId ? { requestId } : {}),
      entityId: claimed.eventId,
      tags: { provider: 'whop', eventType: claimed.eventType },
    })
    throw error
  }
}
