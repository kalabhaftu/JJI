/**
 * lib/services/whop/client.ts
 *
 * Whop SDK singleton and environment configuration.
 *
 * Validates all required environment variables at runtime so
 * misconfiguration surfaces immediately.
 *
 * All Whop-specific server credentials are in this file; nothing else in the
 * application should read WHOP_* env vars directly.
 */

import Whop from '@whop/sdk'

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

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

/**
 * Validated configuration object.
 * Import this instead of reading env vars directly elsewhere.
 */
export const WHOP_CONFIG = {
  get apiKey() {
    return requireEnv('WHOP_API_KEY')
  },
  get webhookSecret() {
    return requireEnv('WHOP_WEBHOOK_SECRET')
  },
  /**
   * Plan ID for the "Pro" tier. Format: plan_xxx or full checkout URL.
   */
  planIds: {
    get pro(): string {
      return requireEnv('WHOP_PLAN_ID_PRO')
    },
  },
  /**
   * 'sandbox' | 'production'
   * Controls checkout URL construction and safety guards.
   */
  get environment() {
    return optionalEnv('WHOP_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production'
  },
}

export type WhopPlanKey = keyof typeof WHOP_CONFIG.planIds

// ---------------------------------------------------------------------------
// SDK singleton
// ---------------------------------------------------------------------------

let _client: Whop | null = null

/**
 * Returns the shared Whop SDK client.
 * Initialised lazily on first call and reused across requests.
 */
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

// Convenience export matching how `db` is used throughout the codebase.
export const whopClient = getWhopClient()
