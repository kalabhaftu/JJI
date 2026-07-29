import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { readTradesForUser } from '@/server/trades/read'
import { getTradesSchema, normalizeTradeLimit } from '@/server/trades/filters'
import { CacheHeaders } from '@/lib/api-cache-headers'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { withCache, getUserCacheVersion } from '@/lib/cache/helpers'
import { CacheKeys, CacheTTL } from '@/lib/cache/keys'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'authenticated-read')
  if (rateLimitRes) return rateLimitRes

  const start = Date.now()
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const params = request.nextUrl.searchParams
    const parsedParams = getTradesSchema.safeParse(Object.fromEntries(params.entries()))

    if (!parsedParams.success) {
      return createErrorResponse(
        'Invalid parameters',
        400,
        parsedParams.error.format(),
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const filters = parsedParams.data
    const limit = normalizeTradeLimit(filters)
    const userVersion = await getUserCacheVersion(internalUserId)
    const paramsHash = crypto.createHash('sha256')
      .update(JSON.stringify({ ...filters, limit }))
      .digest('hex')
      .slice(0, 16)
    const cacheKey = CacheKeys.tradeList(internalUserId, userVersion, paramsHash)

    const payload = await withCache(cacheKey, CacheTTL.tradeList, () => readTradesForUser(internalUserId, filters))
    const response = await createSuccessResponse(
      payload,
      undefined,
      undefined,
      requestId,
      { headers: CacheHeaders.privateShort },
    )

    logger.info({ latencyMs: Date.now() - start, total: payload.trades?.length ?? 0, layer: 'api' }, 'GET /api/v1/trades')
    return response
  } catch (error: any) {
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    if (error.message?.includes('User not found')) {
      return createErrorResponse('User not found', 404, undefined, 'NOT_FOUND', requestId)
    }
    reportError(error, {
      surface: 'api',
      operation: 'list-trades',
      route: request.nextUrl.pathname,
      requestId,
      extra: { latencyMs: Date.now() - start },
    })
    return createErrorResponse('Internal Server Error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
