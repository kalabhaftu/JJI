import { eq } from 'drizzle-orm'
import * as Sentry from '@sentry/nextjs'

import { db } from '@/lib/db/client'
import { WhopWebhookEvent, Subscription, User } from '@/lib/db/schema'
import logger from '@/lib/logger'
import { whopClient } from './client'
import {
  upsertWhopSubscription,
  type WhopMembershipSnapshot,
} from './membership-sync'


export interface WhopWebhookPayload {
  id: string
  type: string
  data: any
  created_at: number
}

export async function processWhopWebhookEvent(payload: WhopWebhookPayload): Promise<void> {
  const { id: eventId, type: eventType, data } = payload

  // Membership events carry the membership object as `data`; payment events
  // carry a payment object with `data.membership_id`.
  const membershipId =
    (eventType.startsWith('membership.') ? data?.id : data?.membership_id) ?? null

  try {
    // The UNIQUE constraint on `eventId` makes duplicate deliveries fail here.
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
      return
    }
    throw err
  }

  try {
    if (eventType.startsWith('membership.')) {
      await handleMembershipEvent(data)
    } else if (eventType.startsWith('payment.')) {
      await handlePaymentEvent(data)
    } else {
      logger.info({ eventType }, '[WhopWebhook] Ignored unhandled event type')
    }

    await db
      .update(WhopWebhookEvent)
      .set({ processingResult: 'processed' })
      .where(eq(WhopWebhookEvent.eventId, eventId))
  } catch (err: any) {
    logger.error({ eventId, eventType, err }, '[WhopWebhook] Failed to process event')
    Sentry.captureException(err, { tags: { operation: 'whop-webhook-processor', eventType } })
    await db
      .update(WhopWebhookEvent)
      .set({
        processingResult: 'error',
        errorMessage: err.message || String(err),
      })
      .where(eq(WhopWebhookEvent.eventId, eventId))
    throw err
  }
}

async function handleMembershipEvent(membershipData: any) {
  if (!membershipData?.id) {
    throw new Error('Membership data missing id')
  }

  const internalUserId = await extractUserId(membershipData)
  if (!internalUserId) {
    logger.warn(
      { membershipId: membershipData.id },
      '[WhopWebhook] Could not map membership to an internal JJI user.',
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
}

// Payment events are logged only; access control relies on membership events.
async function handlePaymentEvent(paymentData: any) {
  const membershipId = paymentData?.membership_id
  if (!membershipId) return

  logger.info({ membershipId, status: paymentData.status }, '[WhopWebhook] Payment event received')
}

async function extractUserId(membershipData: any): Promise<string | null> {
  const userIdFromMetadata = membershipData?.metadata?.jji_user_id
  if (userIdFromMetadata) {
    const user = await db.query.User.findFirst({
      where: eq(User.id, userIdFromMetadata),
    })
    if (user) return user.id
  }

  const buyerEmail =
    membershipData?.user?.email ??
    membershipData?.email ??
    membershipData?.user_email
  if (buyerEmail && typeof buyerEmail === 'string') {
    const cleanEmail = buyerEmail.trim().toLowerCase()
    const user = await db.query.User.findFirst({
      where: eq(User.email, cleanEmail),
    })
    if (user) {
      logger.info({ userId: user.id, email: cleanEmail }, '[WhopWebhook] Mapped membership via email fallback')
      return user.id
    }
  }

  if (membershipData?.user_id) {
    try {
      const whopUser: any = await whopClient.users.retrieve(membershipData.user_id)
      if (whopUser?.email) {
        const cleanEmail = String(whopUser.email).trim().toLowerCase()
        const user = await db.query.User.findFirst({
          where: eq(User.email, cleanEmail),
        })
        if (user) {
          logger.info({ userId: user.id, email: cleanEmail }, '[WhopWebhook] Mapped membership via Whop SDK user lookup')
          return user.id
        }
      }
    } catch (err) {
      logger.warn({ err, whopUserId: membershipData.user_id }, '[WhopWebhook] Whop SDK user lookup failed')
    }
  }

  return null
}
