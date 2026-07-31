import Whop from '@whop/sdk'

// All Whop-specific server credentials live in this file; nothing else in the
// application should read WHOP_* env vars directly.
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `[Whop] Missing required environment variable: ${name}. ` +
      'See docs/whop-integration.md for setup instructions.',
    )
  }
  return value.trim()
}

function optionalEnv(name: string, defaultValue: string): string {
  const value = process.env[name]
  return value?.trim() || defaultValue
}

export const WHOP_CONFIG = {
  get apiKey() {
    return requireEnv('WHOP_API_KEY')
  },
  get webhookSecret() {
    return requireEnv('WHOP_WEBHOOK_SECRET')
  },
  planIds: {
    get pro(): string {
      return requireEnv('WHOP_PLAN_ID_PRO')
    },
  },
  get environment() {
    return optionalEnv('WHOP_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production'
  },
}

export type WhopPlanKey = keyof typeof WHOP_CONFIG.planIds

let _client: Whop | null = null

export function getWhopClient(): Whop {
  if (!_client) {
    _client = new Whop({
      apiKey: WHOP_CONFIG.apiKey,
      baseURL: WHOP_CONFIG.environment === 'sandbox' ? 'https://sandbox-api.whop.com/api/v1' : undefined,
      maxRetries: 0,
      timeout: 15_000,
    })
  }
  return _client
}

export const whopClient = getWhopClient()

import * as Sentry from '@sentry/nextjs'

export async function cancelWhopMembership(membershipId: string): Promise<boolean> {
  try {
    await whopClient.memberships.cancel(membershipId)
    return true
  } catch (error) {
    Sentry.captureException(error, { tags: { operation: 'cancel-whop-membership-jji' } })
    return false
  }
}
