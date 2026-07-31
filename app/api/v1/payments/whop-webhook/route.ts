/**
 * POST /api/v1/payments/whop-webhook
 * 
 * Whop webhook receiver.
 * Verifies HMAC-SHA256 signature and routes to the idempotent event processor.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'
import { verifyWhopWebhookSignature } from '@/lib/services/whop/webhook-verify'
import { processWhopWebhookEvent, type WhopWebhookPayload } from '@/lib/services/whop/event-processor'

// Max payload size from Whop (256 KB safety limit)
const MAX_WEBHOOK_BODY_BYTES = 256 * 1024

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    // 1. Read signature header
    const signature = request.headers.get('webhook-signature')
    if (!signature) {
      logger.warn('[WhopWebhook] Missing webhook-signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // 2. Read raw body (CRITICAL: Do not parse JSON yet!)
    const rawBody = await request.text()

    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
      logger.warn('[WhopWebhook] Payload too large')
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    // 3. Verify Signature
    if (!verifyWhopWebhookSignature(rawBody, signature)) {
      logger.warn('[WhopWebhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 4. Parse JSON now that we trust it
    let payload: WhopWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      logger.warn('[WhopWebhook] Invalid JSON')
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    logger.info(
      { eventId: payload.id, eventType: payload.type },
      '[WhopWebhook] Verified Whop webhook',
    )

    // 5. Process idempotently
    await processWhopWebhookEvent(payload)

    // Return 200 OK fast so Whop doesn't timeout
    return NextResponse.json({ success: true })
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        surface: 'api',
        operation: 'process-whop-webhook',
        route: request.nextUrl.pathname,
        requestId,
      }
    })
    return NextResponse.json({ success: false, error: 'Internal processing error' }, { status: 500 })
  }
}
