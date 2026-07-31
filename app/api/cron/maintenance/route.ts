import { NextRequest, NextResponse } from 'next/server'
import { validateCronRequest } from '@/lib/cron-auth'
import { runSubscriptionChecks, reconcilePendingPayments } from '@/lib/services/subscription-service'
import { createAllDailyAnchors } from '@/lib/services/anchor-service'
import { runDailyMaintenance } from '@/lib/services/maintenance-service'
import { logger } from '@/lib/logger'
import { inngest } from '@/lib/inngest/client'

export async function GET(request: NextRequest) {
  const authError = validateCronRequest(request)
  if (authError) return authError

  const timestamp = new Date().toISOString()
  const results: any = {
    timestamp,
    tasks: {}
  }

  try {
    logger.info('[Maintenance Cron] Starting daily maintenance')

    logger.info('[Maintenance Cron] Task: Payment Reconciliation')
    results.tasks.payments = await reconcilePendingPayments()

    logger.info('[Maintenance Cron] Task: Subscription Checks')
    results.tasks.subscriptions = await runSubscriptionChecks()

    logger.info('[Maintenance Cron] Task: Phase Evaluation')
    await inngest.send({
      name: 'jji/phase.evaluate',
      data: { source: 'maintenance-cron', requestedAt: timestamp },
    })
    results.tasks.phaseEvaluation = { queued: true }

    logger.info('[Maintenance Cron] Task: Daily Anchors')
    results.tasks.dailyAnchors = await createAllDailyAnchors()

    logger.info('[Maintenance Cron] Task: System Cleanup')
    results.tasks.systemCleanup = await runDailyMaintenance()

    logger.info('[Maintenance Cron] Completed successfully')

    return NextResponse.json({
      success: true,
      ...results
    })
  } catch (error) {
    logger.error('[Maintenance Cron] Execution failed: ' + (error instanceof Error ? error.message : String(error)))
    return NextResponse.json({
      success: false,
      error: 'Maintenance failed',
      timestamp
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
