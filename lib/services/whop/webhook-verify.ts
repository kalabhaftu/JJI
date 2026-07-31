/**
 * lib/services/whop/webhook-verify.ts
 *
 * HMAC-SHA256 signature verification for Whop webhook payloads according to
 * the Standard Webhooks specification and Whop SDK.
 */

import Whop from '@whop/sdk'
import { WHOP_CONFIG } from './client'
import { logger } from '@/lib/logger'

/**
 * Verifies that the Whop `webhook-signature` header is valid for the given
 * raw request body.
 *
 * Checks both WHOP_WEBHOOK_SECRET and WHOP_SANDBOX_WEBHOOK_SECRET as a fallback.
 *
 * @param rawBody The raw UTF-8 request body (before JSON parsing).
 * @param headers The HTTP request headers (Headers instance or plain object).
 */
export function verifyWhopWebhookSignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined> | Headers,
): boolean {
  try {
    const secrets = [
      WHOP_CONFIG.webhookSecret,
      process.env.WHOP_SANDBOX_WEBHOOK_SECRET,
    ].filter((s): s is string => Boolean(s && s.trim() !== ''))

    if (secrets.length === 0) {
      logger.warn('[WhopWebhook] No webhook secret configured')
      return false
    }

    // Standardize headers into a plain Record<string, string>
    const normalizedHeaders: Record<string, string> = {}
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        normalizedHeaders[key.toLowerCase()] = value
      })
    } else {
      for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string') {
          normalizedHeaders[key.toLowerCase()] = value
        } else if (Array.isArray(value) && value[0]) {
          normalizedHeaders[key.toLowerCase()] = value[0]
        }
      }
    }

    for (const secret of secrets) {
      try {
        const client = new Whop({
          apiKey: WHOP_CONFIG.apiKey,
          webhookKey: btoa(secret),
        })

        // sdk unwrap verifies signature against Standard Webhooks spec
        const unwrapped = client.webhooks.unwrap(rawBody, { headers: normalizedHeaders })
        if (unwrapped) {
          return true
        }
      } catch (err: any) {
        // Continue to next secret if signature failed
      }
    }

    return false
  } catch (err) {
    logger.error({ err }, '[WhopWebhook] Unexpected error during signature verification')
    return false
  }
}
