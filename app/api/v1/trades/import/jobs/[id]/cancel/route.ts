import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { cancelTradeImportJob } from '@/server/trade-import-jobs'
import { createErrorResponse, createSuccessResponse, ErrorResponses } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyApiRoutePolicy(request, 'import')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return ErrorResponses.unauthorized()
    }

    const { id } = await params
    const result = await cancelTradeImportJob(id, identity.internalUserId)

    if ('error' in result) {
      return createErrorResponse(
        result.error,
        result.status,
        undefined,
        result.status === 404 ? 'NOT_FOUND' : 'IMPORT_CANCEL_FAILED',
      )
    }

    return createSuccessResponse(
      { job: result.job },
      undefined,
      undefined,
      undefined,
      { status: result.status },
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'cancel-trade-import-job',
      route: '/api/v1/trades/import/jobs/[id]/cancel',
    })
    return createErrorResponse('Failed to cancel import job', 500)
  }
}
