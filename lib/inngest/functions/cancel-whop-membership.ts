import { inngest } from '@/lib/inngest/client'
import { reportError } from '@/lib/observability/report-error'
import { normalizeRequestId } from '@/lib/observability/request-id'
import { cancelWhopMembershipImmediately } from '@/lib/services/whop/client'

export const cancelWhopMembership = inngest.createFunction(
  {
    id: 'cancel-whop-membership',
    retries: 5,
    concurrency: { limit: 1, key: 'event.data.membershipId' },
  },
  { event: 'jji/billing.whop-cancel' },
  async ({ event, step }) => {
    const membershipId = String(event.data?.membershipId ?? '')
    const requestId = normalizeRequestId(event.data?.requestId)
      ?? (typeof event.id === 'string' ? event.id : undefined)
    if (!membershipId) throw new Error('Whop cancellation event is missing its membership ID')

    try {
      await step.run('cancel-membership-immediately', () => (
        cancelWhopMembershipImmediately(membershipId)
      ))
      return { membershipId, cancelled: true }
    } catch (error) {
      reportError(error, {
        surface: 'background-job',
        operation: 'cancel-whop-membership',
        entityId: membershipId,
        ...(requestId ? { requestId } : {}),
        tags: { provider: 'whop' },
      })
      throw error
    }
  },
)
