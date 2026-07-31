import Whop from '@whop/sdk'
import { WHOP_CONFIG } from './client'
import { logger } from '@/lib/logger'

export function verifyWhopWebhookSignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined> | Headers,
): boolean {
  try {
    // Tries the main secret first, then the sandbox secret as a fallback.
    const secrets = [
      WHOP_CONFIG.webhookSecret,
      process.env.WHOP_SANDBOX_WEBHOOK_SECRET,
    ].filter((s): s is string => Boolean(s && s.trim() !== ''))

    if (secrets.length === 0) {
      logger.warn('[WhopWebhook] No webhook secret configured')
      return false
    }

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

        const unwrapped = client.webhooks.unwrap(rawBody, { headers: normalizedHeaders })
        if (unwrapped) {
          return true
        }
      } catch {
        // Signature check failed for this secret; try the next one.
      }
    }

    return false
  } catch (err) {
    logger.error({ err }, '[WhopWebhook] Unexpected error during signature verification')
    return false
  }
}
