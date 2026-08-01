import 'server-only'

import { inngest } from '@/lib/inngest/client'

export async function enqueueWhopWebhook(input: {
  eventId: string
  requestId?: string
}) {
  return inngest.send({
    name: 'jji/billing.whop-webhook',
    data: input,
  })
}

export async function enqueueWhopMembershipCancellation(input: {
  membershipId: string
  requestId?: string
}) {
  return inngest.send({
    name: 'jji/billing.whop-cancel',
    data: input,
  })
}
