import 'server-only'

import Whop from '@whop/sdk'

import { getWhopConfig } from '@/lib/services/whop/config'

let apiClient: Whop | null = null
let webhookClient: Whop | null = null

function baseUrl(environment: 'sandbox' | 'production') {
  return environment === 'sandbox'
    ? 'https://sandbox-api.whop.com/api/v1'
    : 'https://api.whop.com/api/v1'
}

export function getWhopClient(): Whop {
  if (!apiClient) {
    const config = getWhopConfig()
    apiClient = new Whop({
      apiKey: config.apiKey,
      baseURL: baseUrl(config.environment),
      maxRetries: 2,
      timeout: 15_000,
    })
  }
  return apiClient
}

export function getWhopWebhookClient(): Whop {
  if (!webhookClient) {
    const config = getWhopConfig()
    webhookClient = new Whop({
      apiKey: config.apiKey,
      // The SDK passes this value directly to Standard Webhooks, which handles
      // the provider's `whsec_` encoding. Re-encoding it breaks verification.
      webhookKey: config.webhookSecret,
      baseURL: baseUrl(config.environment),
      maxRetries: 0,
      timeout: 15_000,
    })
  }
  return webhookClient
}

export async function cancelWhopMembershipImmediately(membershipId: string) {
  return getWhopClient().memberships.cancel(membershipId, {
    cancellation_mode: 'immediate',
  })
}
