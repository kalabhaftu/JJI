import { type NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse, ErrorResponses } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { authenticateDxFeed } from '@/server/integrations/dxfeed'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { DIRECT_SYNC_STATUS, directSyncUnderDevelopmentMessage } from '@/lib/integrations/direct-sync-status'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  if (DIRECT_SYNC_STATUS.isPaused) {
    return createErrorResponse(
      directSyncUnderDevelopmentMessage('DxFeed'),
      503,
      { underDevelopment: true },
      'DIRECT_SYNC_UNAVAILABLE',
      requestId,
    )
  }

  const identity = await getResolvedUserIdentitySafe()
  if (!identity?.internalUserId) return ErrorResponses.unauthorized()

  try {
    const body = await request.json() as { login?: unknown; password?: unknown }
    if (
      typeof body.login !== 'string'
      || body.login.length < 1
      || body.login.length > 320
      || typeof body.password !== 'string'
      || body.password.length < 1
      || body.password.length > 1_000
    ) {
      return ErrorResponses.validation({ fields: ['login', 'password'] })
    }

    const result = await authenticateDxFeed(
      body.login,
      body.password,
      identity.internalUserId,
    )
    if (result.error) {
      return createErrorResponse(
        result.error,
        409,
        undefined,
        'DXFEED_CONNECTION_FAILED',
      )
    }
    return createSuccessResponse(result)
  } catch (error) {
    const requestId = request.headers.get('x-request-id')
    reportError(error, {
      surface: 'api',
      operation: 'connect-dxfeed',
      route: '/api/v1/dxfeed/credentials',
      userId: identity.internalUserId,
      ...(requestId ? { requestId } : {}),
    })
    return ErrorResponses.serverError()
  }
}
