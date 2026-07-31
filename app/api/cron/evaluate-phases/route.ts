import { NextRequest, NextResponse } from 'next/server'
import { validateCronRequest } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { inngest } from '@/lib/inngest/client'

// Now part of the consolidated maintenance cron
export async function GET(request: NextRequest) {
  const authError = validateCronRequest(request)
  if (authError) return authError

  try {
    await inngest.send({
      name: 'jji/phase.evaluate',
      data: { source: 'manual-cron', requestedAt: new Date().toISOString() },
    })
    return NextResponse.json({
      success: true,
      queued: true,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('[Cron] Phase evaluation failed: ' + (error instanceof Error ? error.message : String(error)))
    return NextResponse.json({
      success: false,
      error: 'Evaluation failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
