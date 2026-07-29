import { type NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse, ErrorResponses } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { handleTradovateCallback } from '@/server/integrations/tradovate'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

export async function POST(request: NextRequest) {
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity?.internalUserId) return ErrorResponses.unauthorized()

  try {
    const body = await request.json() as { code?: unknown; state?: unknown }
    if (
      typeof body.code !== 'string'
      || body.code.length < 1
      || body.code.length > 2_000
      || typeof body.state !== 'string'
      || !/^[a-f0-9]{64}$/i.test(body.state)
    ) {
      return ErrorResponses.validation({ fields: ['code', 'state'] })
    }

    const result = await handleTradovateCallback(
      body.code,
      body.state,
      identity.internalUserId,
    )
    if (result.error || !result.accessToken || !result.expiresAt) {
      return createErrorResponse(
        result.error ?? 'Failed to complete OAuth',
        409,
        undefined,
        'TRADOVATE_OAUTH_CALLBACK_FAILED',
      )
    }
    return createSuccessResponse({ connected: true })
  } catch (error) {
    const requestId = request.headers.get('x-request-id')
    reportError(error, {
      surface: 'api',
      operation: 'complete-tradovate-oauth',
      route: '/api/v1/tradovate/oauth/callback',
      userId: identity.internalUserId,
      ...(requestId ? { requestId } : {}),
    })
    return ErrorResponses.serverError()
  }
}
