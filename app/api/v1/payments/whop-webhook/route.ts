import { NextRequest, NextResponse } from 'next/server'

import { reportError } from '@/lib/observability/report-error'
import { REQUEST_ID_HEADER, resolveRequestId } from '@/lib/observability/request-id'
import {
  markWhopWebhookQueued,
  registerWhopWebhook,
} from '@/lib/services/whop/inbox'
import {
  unwrapWhopWebhook,
  WhopWebhookVerificationError,
} from '@/lib/services/whop/webhook'
import { enqueueWhopWebhook } from '@/server/whop-events'

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024

function webhookResponse(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
) {
  return NextResponse.json(body, {
    status,
    headers: { [REQUEST_ID_HEADER]: requestId },
  })
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  try {
    const contentLength = Number(request.headers.get('content-length') || '0')
    if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
      return webhookResponse({ received: false, error: 'Payload too large' }, 413, requestId)
    }

    const rawBody = await request.text()
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
      return webhookResponse({ received: false, error: 'Payload too large' }, 413, requestId)
    }

    const event = unwrapWhopWebhook(rawBody, request.headers)
    const registered = await registerWhopWebhook({ event, rawBody, requestId })

    if (registered.shouldEnqueue) {
      try {
        await enqueueWhopWebhook({ eventId: event.id, requestId })
        await markWhopWebhookQueued(event.id)
      } catch (error) {
        reportError(error, {
          surface: 'api',
          operation: 'enqueue-whop-webhook',
          route: request.nextUrl.pathname,
          requestId,
          entityId: event.id,
          tags: { provider: 'whop', eventType: event.type },
        })
        return webhookResponse({ received: false, retryable: true }, 503, requestId)
      }
    }

    return webhookResponse(
      { received: true, duplicate: !registered.shouldEnqueue },
      registered.shouldEnqueue ? 202 : 200,
      requestId,
    )
  } catch (error) {
    if (error instanceof WhopWebhookVerificationError) {
      return webhookResponse({ received: false, error: 'Invalid signature' }, 401, requestId)
    }
    reportError(error, {
      surface: 'api',
      operation: 'receive-whop-webhook',
      route: request.nextUrl.pathname,
      requestId,
      tags: { provider: 'whop' },
    })
    return webhookResponse({ received: false, retryable: true }, 500, requestId)
  }
}
