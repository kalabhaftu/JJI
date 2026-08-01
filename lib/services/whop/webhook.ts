import 'server-only'

import type { UnwrapWebhookEvent } from '@whop/sdk/resources'

import { getWhopWebhookClient } from '@/lib/services/whop/client'

export class WhopWebhookVerificationError extends Error {
  constructor() {
    super('Invalid Whop webhook signature')
    this.name = 'WhopWebhookVerificationError'
  }
}

function normalizedHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    [...headers.entries()].map(([key, value]) => [key.toLowerCase(), value]),
  )
}

export function unwrapWhopWebhook(
  rawBody: string,
  headers: Headers,
): UnwrapWebhookEvent {
  try {
    return getWhopWebhookClient().webhooks.unwrap(rawBody, {
      headers: normalizedHeaders(headers),
    })
  } catch {
    throw new WhopWebhookVerificationError()
  }
}

export function getWhopWebhookResourceId(event: UnwrapWebhookEvent): string | null {
  const data = event.data as { id?: unknown }
  return typeof data?.id === 'string' ? data.id : null
}

export function whopWebhookNeedsManualReview(type: string): boolean {
  return type.startsWith('dispute.')
    || type === 'dispute_alert.created'
    || type.startsWith('resolution_center_case.')
}

export function parseWhopWebhookTimestamp(value: string): Date | null {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
