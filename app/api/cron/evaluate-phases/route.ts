import { NextRequest, NextResponse } from 'next/server'
import { validateCronRequest } from '@/lib/cron-auth'
import { inngest } from '@/lib/inngest/client'
import { reportError } from '@/lib/observability/report-error'

/**
 * GET /api/cron/evaluate-phases
 * Manually trigger phase evaluations.
 * (Now part of the consolidated maintenance cron)
 */
export async function GET(request: NextRequest) {
  const authError = validateCronRequest(request)
  if (authError) return authError
  const requestId = request.headers.get('x-request-id') ?? undefined

  try {
    await inngest.send({
      name: 'jji/phase.evaluate',
      data: {
        source: 'manual-cron',
        requestedAt: new Date().toISOString(),
        ...(requestId ? { requestId } : {}),
      },
    })
    return NextResponse.json({
      success: true,
      queued: true,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    reportError(error, {
      surface: 'cron',
      operation: 'queue-phase-evaluation',
      route: '/api/cron/evaluate-phases',
      ...(requestId ? { requestId } : {}),
    })
    return NextResponse.json({
      success: false,
      error: 'Evaluation failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * POST /api/cron/evaluate-phases
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
