import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { validateCronRequest } from '@/lib/cron-auth'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const authError = validateCronRequest(request)
  if (authError) return authError

  try {
    await inngest.send({
      name: 'cron/daily-anchor-reset',
      data: { requestId },
    })

    return NextResponse.json(
      { success: true, queued: true },
      { headers: { 'x-request-id': requestId } },
    )
  } catch (error) {
    reportError(error, {
      surface: 'cron',
      operation: 'queue-daily-anchor-reset',
      route: '/api/cron/daily-anchor',
      requestId,
    })
    return NextResponse.json(
      { error: 'Failed to queue job' },
      { status: 500, headers: { 'x-request-id': requestId } },
    )
  }
}
