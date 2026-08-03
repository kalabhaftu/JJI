

import { NextRequest, NextResponse } from 'next/server'
import { runSubscriptionChecks } from '@/lib/services/subscription-service'
import { validateCronRequest } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { reportError } from '@/lib/observability/report-error'

export async function GET(request: NextRequest) {
  const authError = validateCronRequest(request)
  if (authError) return authError

  try {
    logger.info('[Cron] Running subscription checks')
    const results = await runSubscriptionChecks()

    logger.info('[Cron] Subscription check completed: ' + JSON.stringify(results))

    return NextResponse.json({
      success: true,
      message: 'Subscription checks completed',
      ...results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const requestId = request.headers.get('x-request-id')
    reportError(error, {
      surface: 'cron',
      operation: 'check-subscriptions',
      route: '/api/cron/check-subscriptions',
      ...(requestId ? { requestId } : {}),
    })
    return NextResponse.json(
      { success: false, error: 'Subscription check failed', timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
