/**
 * GET /api/cron/reconcile-payments
 * Reconciles pending NOWPayments records on a shorter cadence than subscription renewal checks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateCronRequest } from '@/lib/cron-auth'
import { reconcilePendingPayments } from '@/lib/services/subscription-service'
import { logger } from '@/lib/logger'
import { reportError } from '@/lib/observability/report-error'

export async function GET(request: NextRequest) {
  const authError = validateCronRequest(request)
  if (authError) return authError

  try {
    logger.info('[Cron] Running payment reconciliation')
    const results = await reconcilePendingPayments()

    return NextResponse.json({
      success: true,
      message: 'Payment reconciliation completed',
      ...results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const requestId = request.headers.get('x-request-id')
    reportError(error, {
      surface: 'cron',
      operation: 'reconcile-payments',
      route: '/api/cron/reconcile-payments',
      ...(requestId ? { requestId } : {}),
    })
    return NextResponse.json(
      { success: false, error: 'Payment reconciliation failed', timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
