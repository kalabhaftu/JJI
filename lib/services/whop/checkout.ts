import { db } from '@/lib/db/client'
import { User } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { WHOP_CONFIG, whopClient, type WhopPlanKey } from './client'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export interface WhopCheckoutResult {
  checkoutUrl: string
  planId: string
  referenceId: string
}

export async function createWhopCheckoutLink(
  internalUserId: string,
  planKey: WhopPlanKey,
): Promise<WhopCheckoutResult> {
  const rawPlanValue = WHOP_CONFIG.planIds[planKey]
  if (!rawPlanValue) {
    throw new Error(`[Whop] Unknown plan key: ${planKey}`)
  }

  const referenceId = `jji_${internalUserId}_${Date.now()}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.justjournalit.site'
  const redirectSuccessUrl = `${appUrl}/subscribe/success`

  const user = await db.query.User.findFirst({
    where: eq(User.id, internalUserId),
    columns: { email: true }
  })
  const userEmail = user?.email || ''

  let resolvedPlanId = rawPlanValue
  const checkoutSplit = rawPlanValue.split('checkout/')[1]
  if (checkoutSplit) {
    const segment = checkoutSplit.split('/')[0]
    if (segment) {
      const parts = segment.split('?')[0]
      if (parts) resolvedPlanId = parts
    }
  }

  try {
    const sessionConfig: any = {
      plan_id: resolvedPlanId,
      metadata: {
        jji_user_id: internalUserId,
        jji_reference_id: referenceId,
      },
    }

    if (userEmail) {
      sessionConfig.email = userEmail
    }

    const session = await whopClient.checkoutConfigurations.create(sessionConfig)

    let sessionUrl = (session as any)?.url || (session as any)?.purchase_url
    if (sessionUrl) {
      logger.info({ planKey, sessionId: (session as any).id }, '[WhopCheckout] Created dynamic checkout configuration session')

      if (userEmail) {
        const parsedUrl = new URL(sessionUrl)
        parsedUrl.searchParams.set('email', userEmail)
        sessionUrl = parsedUrl.toString()
      }

      return {
        checkoutUrl: sessionUrl,
        planId: resolvedPlanId,
        referenceId,
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, '[WhopCheckout] API checkout session creation failed, falling back to direct URL')
    Sentry.captureException(err, { tags: { operation: 'create-whop-checkout' } })
  }

  let baseUrl = rawPlanValue
  if (!baseUrl.startsWith('http')) {
    baseUrl = `https://whop.com/checkout/${rawPlanValue}/`
  }

  const url = new URL(baseUrl)
  url.searchParams.set('d2c', '1')
  url.searchParams.set('metadata[jji_user_id]', internalUserId)
  url.searchParams.set('metadata[jji_reference_id]', referenceId)
  url.searchParams.set('redirect_url', redirectSuccessUrl)
  url.searchParams.set('success_url', redirectSuccessUrl)
  if (userEmail) {
    url.searchParams.set('email', userEmail)
  }

  return {
    checkoutUrl: url.toString(),
    planId: resolvedPlanId,
    referenceId,
  }
}
