import { and, asc, eq, inArray, isNull, lt, or } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { WhopMembership, WhopWebhookEvent } from '@/lib/db/schema'
import { inngest } from '@/lib/inngest/client'
import { normalizeRequestId } from '@/lib/observability/request-id'
import { reconcileWhopMembership } from '@/lib/services/whop/membership-sync'

export const reconcileWhopBilling = inngest.createFunction(
  {
    id: 'reconcile-whop-billing',
    retries: 3,
    concurrency: { limit: 1 },
  },
  [
    { cron: 'TZ=UTC 17 */6 * * *' },
    { event: 'jji/billing.whop-reconcile' },
  ],
  async ({ event, step }) => {
    const requestId = 'requestId' in event.data
      ? normalizeRequestId(event.data.requestId)
      : typeof event.id === 'string' ? event.id : undefined

    const memberships = await step.run('list-whop-memberships', () => (
      db.query.WhopMembership.findMany({
        where: inArray(WhopMembership.status, [
          'active',
          'trialing',
          'past_due',
          'canceling',
        ]),
        columns: { membershipId: true },
        limit: 250,
      })
    ))

    let reconciled = 0
    for (const membership of memberships) {
      await step.run(`reconcile-${membership.membershipId}`, () => (
        reconcileWhopMembership(
          membership.membershipId,
          requestId ? { requestId } : {},
        )
      ))
      reconciled += 1
    }

    const staleCutoff = new Date(Date.now() - 10 * 60_000)
    const expiredLeaseCutoff = new Date()
    const recoverable = await step.run('list-recoverable-whop-events', () => (
      db.query.WhopWebhookEvent.findMany({
        where: or(
          inArray(WhopWebhookEvent.status, ['received', 'failed']),
          and(
            eq(WhopWebhookEvent.status, 'queued'),
            lt(WhopWebhookEvent.updatedAt, staleCutoff),
          ),
          and(
            eq(WhopWebhookEvent.status, 'processing'),
            or(
              isNull(WhopWebhookEvent.leaseExpiresAt),
              lt(WhopWebhookEvent.leaseExpiresAt, expiredLeaseCutoff),
            ),
          ),
        ),
        columns: { eventId: true, requestId: true },
        orderBy: [asc(WhopWebhookEvent.createdAt)],
        limit: 100,
      })
    ))

    for (const webhookEvent of recoverable) {
      await step.sendEvent(`retry-${webhookEvent.eventId}`, {
        name: 'jji/billing.whop-webhook',
        data: {
          eventId: webhookEvent.eventId,
          ...(webhookEvent.requestId ? { requestId: webhookEvent.requestId } : {}),
        },
      })
    }

    return { reconciled, recovered: recoverable.length }
  },
)
