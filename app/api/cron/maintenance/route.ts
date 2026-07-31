import { NextRequest, NextResponse } from 'next/server'
import { validateCronRequest } from '@/lib/cron-auth'
import { runSubscriptionChecks, reconcilePendingPayments } from '@/lib/services/subscription-service'
import { createAllDailyAnchors } from '@/lib/services/anchor-service'
import { runDailyMaintenance } from '@/lib/services/maintenance-service'
import { logger } from '@/lib/logger'
import { inngest } from '@/lib/inngest/client'

/**
 * GET /api/cron/maintenance
 * Consolidated daily maintenance task for Vercel Hobby accounts.
 * Orchestrates all background processing in a single daily run.
 */
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

    // 1. Payment Reconciliation
    logger.info('[Maintenance Cron] Task: Payment Reconciliation')
    results.tasks.payments = await reconcilePendingPayments()

    // 2. Subscription Checks (Due dates, expiries)
    logger.info('[Maintenance Cron] Task: Subscription Checks')
    results.tasks.subscriptions = await runSubscriptionChecks()

    // 3. Phase Evaluation (Prop firm breaches/passes)
    logger.info('[Maintenance Cron] Task: Phase Evaluation')
    await inngest.send({
      name: 'jji/phase.evaluate',
      data: { source: 'maintenance-cron', requestedAt: timestamp },
    })
    results.tasks.phaseEvaluation = { queued: true }

    // 4. Daily Anchors (Equity snapshots)
    logger.info('[Maintenance Cron] Task: Daily Anchors')
    results.tasks.dailyAnchors = await createAllDailyAnchors()

    // 5. System Cleanup (Logs, Imports)
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

/**
 * POST /api/cron/maintenance
 * Manual trigger for testing
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
