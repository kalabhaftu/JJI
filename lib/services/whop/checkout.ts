import 'server-only'

import { getWebsiteURL } from '@/server/auth/client'
import { getWhopClient } from '@/lib/services/whop/client'
import { getWhopConfig, type WhopPlanKey } from '@/lib/services/whop/config'

export interface WhopCheckoutResult {
  checkoutUrl: string
  checkoutId: string
  planId: string
  referenceId: string
}

function assertWhopCheckoutUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' || (url.hostname !== 'whop.com' && !url.hostname.endsWith('.whop.com'))) {
    throw new Error('Whop returned an invalid checkout URL')
  }
  return url.toString()
}

export async function createWhopCheckoutLink(input: {
  internalUserId: string
  email: string
  planKey: WhopPlanKey
  requestId: string
}): Promise<WhopCheckoutResult> {
  const config = getWhopConfig()
  const planId = config.planIds[input.planKey]
  const referenceId = `jji_${crypto.randomUUID()}`
  const websiteUrl = await getWebsiteURL()
  const redirectUrl = new URL('/subscribe/success?provider=whop', websiteUrl).toString()

  const checkout = await getWhopClient().checkoutConfigurations.create({
    plan_id: planId,
    redirect_url: redirectUrl,
    metadata: {
      jji_user_id: input.internalUserId,
      jji_reference_id: referenceId,
    },
    'Idempotency-Key': `jji-checkout-${input.requestId}`.slice(0, 200),
  })

  if (!checkout.purchase_url) {
    throw new Error('Whop checkout configuration did not return a purchase URL')
  }

  const purchaseUrl = new URL(assertWhopCheckoutUrl(checkout.purchase_url))


  purchaseUrl.searchParams.set('email', input.email)
  purchaseUrl.searchParams.set('email.disabled', '1')

  return {
    checkoutUrl: purchaseUrl.toString(),
    checkoutId: checkout.id,
    planId,
    referenceId,
  }
}

