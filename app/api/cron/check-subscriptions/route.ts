/**
 * GET /api/cron/check-subscriptions
 * Daily cron job: checks upcoming payment dues, sends notifications,
 * and expires overdue subscriptions past grace period.
 *
 * Runs daily at 8:00 UTC via Vercel Cron.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runSubscriptionChecks } from '@/lib/services/subscription-service'
import { validateCronRequest } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

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
    logger.error('[Cron] Subscription check failed: ' + (error instanceof Error ? error.message : String(error)))
    return NextResponse.json(
      { success: false, error: 'Subscription check failed', timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
