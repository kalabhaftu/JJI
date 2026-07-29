/**
 * Prop Firm Analytics API (v1)
 *
 * GET /api/v1/reports/propfirm
 *
 * Returns all funded/challenge account stats computed server-side.
 */

import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { calculatePropFirmStatistics } from '@/lib/statistics/propfirm-statistics'
import { CacheHeaders } from '@/lib/api-cache-headers'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { logger } from '@/lib/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  const start = Date.now()
  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const result = await calculatePropFirmStatistics(identity.internalUserId)

    logger.info({ latencyMs: Date.now() - start, context: 'api' }, 'GET /api/v1/reports/propfirm')
    return createSuccessResponse(
      result,
      undefined,
      undefined,
      requestId,
      { headers: CacheHeaders.privateShort },
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'get-prop-firm-report',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Internal server error',
      500,
      undefined,
      'PROP_FIRM_REPORT_FAILED',
      requestId,
    )
  }
}
