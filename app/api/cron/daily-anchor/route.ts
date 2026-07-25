import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import logger from '@/lib/logger'
import { validateCronRequest } from '@/lib/cron-auth'

export async function GET(request: NextRequest) {
  const authError = validateCronRequest(request)
  if (authError) return authError

  try {
    await inngest.send({
      name: 'cron/daily-anchor-reset',
      data: {},
    })

    return NextResponse.json({ success: true, queued: true })
  } catch (error) {
    logger.error({ error, event: 'cron_failed' }, 'Failed to trigger daily anchor reset')
    return NextResponse.json({ error: 'Failed to queue job' }, { status: 500 })
  }
}
