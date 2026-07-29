import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { validateCronRequest } from '@/lib/cron-auth'
import { reportError } from '@/lib/observability/report-error'

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
    const requestId = request.headers.get('x-request-id')
    reportError(error, {
      surface: 'cron',
      operation: 'queue-daily-anchor-reset',
      route: '/api/cron/daily-anchor',
      ...(requestId ? { requestId } : {}),
    })
    return NextResponse.json({ error: 'Failed to queue job' }, { status: 500 })
  }
}
