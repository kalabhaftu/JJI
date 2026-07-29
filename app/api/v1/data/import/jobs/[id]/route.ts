import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { getImportJobForUser, serializeImportJob } from '@/server/import-jobs'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'import')
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

    return createSuccessResponse({ job: serializeImportJob(job) }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'get-archive-import-job',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to fetch import job', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
