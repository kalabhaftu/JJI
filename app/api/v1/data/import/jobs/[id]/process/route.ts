import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { getImportJobForUser, serializeImportJob } from '@/server/import-jobs'
import { enqueueImportJob } from '@/server/import-job-events'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
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
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const { id } = await params
    const job = await getImportJobForUser(id, identity.internalUserId)
    if (!job) {
      return createErrorResponse('Import job not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
      await enqueueImportJob({
        jobId: id,
        internalUserId: identity.internalUserId,
        kind: 'archive',
        requestId,
      })
    }

    return createSuccessResponse({
      done: job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled',
      job: serializeImportJob(job),
    }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'process-archive-import-job',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to process import job', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
