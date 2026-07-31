/**
 * lib/services/whop/webhook-verify.ts
 *
 * HMAC-SHA256 signature verification for Whop webhook payloads.
 *
 * Whop sends a `webhook-signature` header in the format:
 *   v1,<base64-encoded-HMAC-SHA256-of-raw-body>
 *
 * This module verifies the signature using a timing-safe comparison to
 * prevent timing-oracle attacks.
 *
 * IMPORTANT: The raw body (string) must be passed — do NOT pre-parse to JSON.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { WHOP_CONFIG } from './client'

/**
 * Parses the Whop `webhook-signature` header value.
 * Returns null when the format is unexpected.
 *
 * @example "v1,abc123==" → { version: 'v1', signature: Buffer }
 */
function parseSignatureHeader(header: string): { version: string; signature: Buffer } | null {
  const commaIdx = header.indexOf(',')
  if (commaIdx === -1) return null

  const version = header.slice(0, commaIdx)
  const encodedSig = header.slice(commaIdx + 1)

  if (!version || !encodedSig) return null

  try {
    return { version, signature: Buffer.from(encodedSig, 'base64') }
  } catch {
    return null
  }
}

/**
 * Computes the HMAC-SHA256 of the raw body using the webhook secret.
 */
function computeHmac(rawBody: string): Buffer {
  return createHmac('sha256', WHOP_CONFIG.webhookSecret)
    .update(rawBody, 'utf8')
    .digest()
}

/**
 * Verifies that the Whop `webhook-signature` header is valid for the given
 * raw request body.
 *
 * - Returns `true` if the signature is valid.
 * - Returns `false` for any invalid or unexpected input (never throws).
 * - Uses `timingSafeEqual` to prevent timing-oracle side-channel attacks.
 *
 * @param rawBody       The raw UTF-8 request body (before JSON parsing).
 * @param signatureHeader The value of the `webhook-signature` request header.
 */
export function verifyWhopWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
): boolean {
  try {
    if (!signatureHeader) return false

    const parsed = parseSignatureHeader(signatureHeader)
    if (!parsed) return false

    // Currently only 'v1' is supported. Reject unknown versions.
    if (parsed.version !== 'v1') return false

    const expected = computeHmac(rawBody)

    if (parsed.signature.length !== expected.length) return false

    return timingSafeEqual(parsed.signature, expected)
  } catch {
    return false
  }
}
