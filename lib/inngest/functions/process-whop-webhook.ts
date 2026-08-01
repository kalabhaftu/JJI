import { inngest } from '@/lib/inngest/client'
import { normalizeRequestId } from '@/lib/observability/request-id'
import { processWhopWebhookEvent } from '@/lib/services/whop/processor'

export const processWhopWebhook = inngest.createFunction(
  {
    id: 'process-whop-webhook',
    retries: 5,
    concurrency: { limit: 1, key: 'event.data.eventId' },
  },
  { event: 'jji/billing.whop-webhook' },
  async ({ event, step }) => {
    const eventId = String(event.data?.eventId ?? '')
    if (!eventId) throw new Error('Whop webhook event is missing its event ID')
    const requestId = normalizeRequestId(event.data?.requestId)
      ?? (typeof event.id === 'string' ? event.id : undefined)

    return step.run('process-verified-whop-event', () => (
      processWhopWebhookEvent(eventId, requestId)
    ))
  },
)
