import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { enqueueImportJob } from '@/server/import-job-events'
import { resumeImportJob } from '@/server/import-jobs'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'import')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse(
        'Unauthorized',
        401,
        undefined,
        'UNAUTHORIZED',
        requestId,
      )
    }
    const { id } = await params
    const result = await resumeImportJob(id, identity.internalUserId, {
      source: 'api',
      requestId,
    })
    if ('error' in result) {
      return createErrorResponse(
        result.error,
        result.status,
        undefined,
        result.status === 404 ? 'NOT_FOUND' : 'IMPORT_NOT_RESUMABLE',
        requestId,
      )
    }

    await enqueueImportJob({
      jobId: id,
      internalUserId: identity.internalUserId,
      kind: 'archive',
      requestId,
    })
    return createSuccessResponse(
      { job: result.job },
      'Import job resumed',
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'resume-archive-import-job',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to resume import job',
      500,
      undefined,
      'IMPORT_RESUME_FAILED',
      requestId,
    )
  }
}
