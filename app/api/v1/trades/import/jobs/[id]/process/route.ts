import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { getTradeImportJobForUser } from '@/server/trade-import-jobs'
import { enqueueImportJob } from '@/server/import-job-events'
import { createErrorResponse, createSuccessResponse, ErrorResponses } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'import-job-process')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return ErrorResponses.unauthorized(requestId)
    }

    const { id } = await params
    const job = await getTradeImportJobForUser(id, identity.internalUserId)
    if (!job) {
      return ErrorResponses.notFound('Import job', requestId)
    }

    if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
      await enqueueImportJob({
        jobId: id,
        internalUserId: identity.internalUserId,
        kind: 'trade',
        requestId,
      })
    }

    return createSuccessResponse({
      done: job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled',
      job,
    }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'process-trade-import-job',
      route: '/api/v1/trades/import/jobs/[id]/process',
      requestId,
    })
    return createErrorResponse('Failed to process import job', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
