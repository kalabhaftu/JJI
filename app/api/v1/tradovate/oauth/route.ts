import { type NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse, ErrorResponses } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { initiateTradovateOAuth } from '@/server/integrations/tradovate'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

export async function POST(request: NextRequest) {
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity?.internalUserId) return ErrorResponses.unauthorized()

  try {
    const body = await request.json() as { accountId?: unknown }
    const accountId = body.accountId === undefined ? 'default' : body.accountId
    if (typeof accountId !== 'string' || accountId.length < 1 || accountId.length > 200) {
      return ErrorResponses.validation({ fields: ['accountId'] })
    }

    const result = await initiateTradovateOAuth(
      accountId,
      identity.internalUserId,
    )
    if (result.error || !result.authUrl || !result.state) {
      return createErrorResponse(
        result.error ?? 'Failed to start OAuth',
        409,
        undefined,
        'TRADOVATE_OAUTH_START_FAILED',
      )
    }
    return createSuccessResponse({
      authUrl: result.authUrl,
      state: result.state,
    })
  } catch (error) {
    const requestId = request.headers.get('x-request-id')
    reportError(error, {
      surface: 'api',
      operation: 'start-tradovate-oauth',
      route: '/api/v1/tradovate/oauth',
      userId: identity.internalUserId,
      ...(requestId ? { requestId } : {}),
    })
    return ErrorResponses.serverError()
  }
}
