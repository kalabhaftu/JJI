import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { UnwrapWebhookEvent } from '@whop/sdk/resources'

import { db } from '@/lib/db/client'
import { WhopWebhookEvent } from '@/lib/db/schema'
import {
  getWhopWebhookResourceId,
  parseWhopWebhookTimestamp,
  whopWebhookNeedsManualReview,
} from '@/lib/services/whop/webhook'

export async function registerWhopWebhook(input: {
  event: UnwrapWebhookEvent
  rawBody: string
  requestId: string
}) {
  const payloadHash = createHash('sha256').update(input.rawBody).digest('hex')
  const [inserted] = await db.insert(WhopWebhookEvent).values({
    eventId: input.event.id,
    eventType: input.event.type,
    resourceId: getWhopWebhookResourceId(input.event),
    requestId: input.requestId,
    payloadHash,
    reviewRequired: whopWebhookNeedsManualReview(input.event.type),
    occurredAt: parseWhopWebhookTimestamp(input.event.timestamp),
  }).onConflictDoNothing({ target: WhopWebhookEvent.eventId }).returning()

  const webhookEvent = inserted ?? await db.query.WhopWebhookEvent.findFirst({
    where: eq(WhopWebhookEvent.eventId, input.event.id),
  })
  if (!webhookEvent) throw new Error('Whop webhook inbox write did not persist')
  if (webhookEvent.payloadHash !== payloadHash) {
    throw new Error('Whop webhook event ID was reused with a different payload')
  }

  return {
    event: webhookEvent,
    shouldEnqueue: webhookEvent.status !== 'processed' && webhookEvent.status !== 'ignored',
  }
}

export async function markWhopWebhookQueued(eventId: string) {
  await db.update(WhopWebhookEvent).set({
    status: 'queued',
    queuedAt: new Date(),
    lastErrorCode: null,
    updatedAt: new Date(),
  }).where(and(
    eq(WhopWebhookEvent.eventId, eventId),
    eq(WhopWebhookEvent.status, 'received'),
  ))
}
