/**
 * lib/services/whop/event-processor.ts
 *
 * Processes Whop webhook events idempotently.
 * Converts Whop events into database state changes for user subscriptions.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { WhopWebhookEvent, Subscription, User } from '@/lib/db/schema'
import logger from '@/lib/logger'
import {
  upsertWhopSubscription,
  type WhopMembershipSnapshot,
} from './membership-sync'


export interface WhopWebhookPayload {
  id: string         // event id
  type: string       // e.g. 'membership.activated'
  data: any          // The actual payload data (membership, payment, etc.)
  created_at: number // Unix timestamp
}

/**
 * Attempts to process a Whop webhook payload idempotently.
 *
 * If this exact event ID has already been processed (or is currently being
 * processed by a concurrent request), this will safely exit without side effects.
 */
export async function processWhopWebhookEvent(payload: WhopWebhookPayload): Promise<void> {
  const { id: eventId, type: eventType, data } = payload

  // We map the Whop membership ID if it's available in the payload.
  // Whop sends membership events (data = membership object)
  // and payment events (data = payment object, data.membership_id).
  const membershipId =
    (eventType.startsWith('membership.') ? data?.id : data?.membership_id) ?? null

  try {
    // 1. Idempotency Lock / Insert
    // This insert will fail with a unique constraint violation if `eventId` already exists.
    await db.insert(WhopWebhookEvent).values({
      eventId,
      eventType,
      membershipId,
      processingResult: 'pending',
      rawPayload: payload as any,
    })
  } catch (err: any) {
    if (err.code === '23505' || err.message?.includes('unique constraint')) {
      logger.info({ eventId, eventType }, '[WhopWebhook] Duplicate event ignored')
      return // Already processed
    }
    throw err
  }

  try {
    // 2. Route event
    if (eventType.startsWith('membership.')) {
      await handleMembershipEvent(data)
    } else if (eventType.startsWith('payment.')) {
      await handlePaymentEvent(data)
    } else {
      logger.info({ eventType }, '[WhopWebhook] Ignored unhandled event type')
    }

    // 3. Mark successful
    await db
      .update(WhopWebhookEvent)
      .set({ processingResult: 'processed' })
      .where(eq(WhopWebhookEvent.eventId, eventId))
  } catch (err: any) {
    // 4. Mark failed
    logger.error({ eventId, eventType, err }, '[WhopWebhook] Failed to process event')
    await db
      .update(WhopWebhookEvent)
      .set({
        processingResult: 'error',
        errorMessage: err.message || String(err),
      })
      .where(eq(WhopWebhookEvent.eventId, eventId))
    throw err // Let the caller (or Inngest) retry
  }
}

/**
 * Handles all `membership.*` events.
 * Since Whop events include the full membership object snapshot,
 * our logic is mostly purely state-based: we map the Whop state to our DB state.
 */
async function handleMembershipEvent(membershipData: any) {
  if (!membershipData?.id) {
    throw new Error('Membership data missing id')
  }

  // Find the internal user ID
  const internalUserId = await extractUserId(membershipData)
  if (!internalUserId) {
    logger.warn(
      { membershipId: membershipData.id },
      '[WhopWebhook] Could not map membership to an internal JJI user. No metadata[jji_user_id] found.',
    )
    return
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

  await upsertWhopSubscription(snapshot, internalUserId)

  // Revalidate access caches so UI reflects new status
  // Subscription access check logic handles revalidation automatically on main
}

/**
 * Handles `payment.*` events.
 * Whop's payment events usually just mean we should pull the latest membership state.
 * For now, we trust the `membership.*` events for access control, but we log payments.
 */
async function handlePaymentEvent(paymentData: any) {
  const membershipId = paymentData?.membership_id
  if (!membershipId) return

  // We could fetch the full membership from the Whop API here via reconcileWhopMembership,
  // but usually Whop sends a `membership.activated` or `membership.deactivated` event
  // right after a payment event.
  logger.info({ membershipId, status: paymentData.status }, '[WhopWebhook] Payment event received')
}

/**
 * Extracts the internal JJI User ID from a Whop membership.
 * We require `metadata.jji_user_id` to be set during checkout.
 */
async function extractUserId(membershipData: any): Promise<string | null> {
  const userIdFromMetadata = membershipData?.metadata?.jji_user_id
  if (userIdFromMetadata) {
    // Verify user exists
    const user = await db.query.User.findFirst({
      where: eq(User.id, userIdFromMetadata),
    })
    if (user) return user.id
  }
  return null
}
