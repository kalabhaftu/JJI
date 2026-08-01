import { inArray } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { WhopMembership } from '@/lib/db/schema'
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

    return { reconciled }
  },
)
