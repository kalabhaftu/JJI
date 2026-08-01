import { and, asc, eq, inArray, isNull, lt, or } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { WhopWebhookEvent } from '@/lib/db/schema'
import { inngest } from '@/lib/inngest/client'

export const recoverWhopInbox = inngest.createFunction(
  {
    id: 'recover-whop-inbox',
    retries: 3,
    concurrency: { limit: 1 },
  },
  { cron: 'TZ=UTC */15 * * * *' },
  async ({ step }) => {
    const staleQueuedCutoff = new Date(Date.now() - 10 * 60_000)
    const expiredLeaseCutoff = new Date()
    const recoverable = await step.run('list-recoverable-whop-events', () => (
      db.query.WhopWebhookEvent.findMany({
        where: or(
          inArray(WhopWebhookEvent.status, ['received', 'failed']),
          and(
            eq(WhopWebhookEvent.status, 'queued'),
            lt(WhopWebhookEvent.updatedAt, staleQueuedCutoff),
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

    for (const event of recoverable) {
      await step.sendEvent(`retry-${event.eventId}`, {
        name: 'jji/billing.whop-webhook',
        data: {
          eventId: event.eventId,
          ...(event.requestId ? { requestId: event.requestId } : {}),
        },
      })
    }

    return { recovered: recoverable.length }
  },
)
