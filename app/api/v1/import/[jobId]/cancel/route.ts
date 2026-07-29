import { NextRequest } from 'next/server'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { cancelTradeImportJob } from '@/server/trade-import-jobs'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'import')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const { jobId } = await params
    const result = await cancelTradeImportJob(jobId, identity.internalUserId)

    if ('error' in result) {
      return createErrorResponse(
        result.error,
        result.status,
        undefined,
        result.status === 404 ? 'NOT_FOUND' : 'IMPORT_CANCEL_FAILED',
        requestId,
      )
    }

    return createSuccessResponse(
      { job: result.job },
      undefined,
      undefined,
      requestId,
      { status: result.status },
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'cancel-import-job',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to cancel import job', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
