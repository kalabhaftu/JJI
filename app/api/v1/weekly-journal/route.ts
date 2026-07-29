import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import {
  getWeeklyReviewForUser,
  saveWeeklyReviewForUser,
} from '@/server/weekly-review-domain'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    const startDate = request.nextUrl.searchParams.get('startDate')
    if (!startDate || Number.isNaN(new Date(startDate).getTime())) {
      return createErrorResponse('Valid startDate is required', 400, undefined, 'VALIDATION_ERROR', requestId)
    }
    return createSuccessResponse(
      await getWeeklyReviewForUser(identity.internalUserId, new Date(startDate)) ?? null,
      undefined,
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'get-weekly-journal', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to load weekly review', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function PUT(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    const body = await request.json().catch(() => null)
    const startDate = new Date(body?.startDate)
    const endDate = new Date(body?.endDate)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return createErrorResponse('Valid review dates are required', 400, undefined, 'VALIDATION_ERROR', requestId)
    }
    const review = await saveWeeklyReviewForUser(identity.internalUserId, {
      ...body,
      startDate,
      endDate,
    }, {
      source: 'api',
      requestId,
      ipAddress: getClientIp(request.headers),
    })
    return createSuccessResponse(review, 'Weekly review saved', undefined, requestId)
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'save-weekly-journal', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to save weekly review', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
