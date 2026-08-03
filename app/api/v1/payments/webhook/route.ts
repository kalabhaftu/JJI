

import { NextRequest, NextResponse } from 'next/server'
import { verifyIpnSignature, type IpnPayload } from '@/lib/services/nowpayments-service'
import { handleIpnWebhook } from '@/lib/services/subscription-service'
import { logger } from '@/lib/logger'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  try {
    const signature = request.headers.get('x-nowpayments-sig') || ''
    const rawBody = await request.text()

    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    let payload: IpnPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      logger.warn('Invalid NOWPayments webhook JSON')
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (!verifyIpnSignature(payload as unknown as Record<string, unknown>, signature)) {
      logger.warn('Invalid NOWPayments webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    logger.info('Verified NOWPayments webhook' + ' : ' + JSON.stringify({
      status: payload.payment_status,
      hasOrderId: Boolean(payload.order_id),
    }))

    const result = await handleIpnWebhook(payload)
    const status = typeof result.status === 'number' ? result.status : 200

    return NextResponse.json({ success: status < 400, ...result }, { status })
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'process-payment-webhook',
      route: request.nextUrl.pathname,
      requestId,
    })
    return NextResponse.json({ success: false, error: 'Internal processing error' }, { status: 500 })
  }
}
