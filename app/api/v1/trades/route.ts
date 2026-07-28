import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import crypto from 'crypto'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { readTradesForUser } from '@/server/trades/read'
import { getTradesSchema, normalizeTradeLimit } from '@/server/trades/filters'
import { CacheHeaders } from '@/lib/api-cache-headers'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { withCache, getUserCacheVersion } from '@/lib/cache/helpers'
import { CacheKeys, CacheTTL } from '@/lib/cache/keys'

export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  const start = Date.now()
  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const params = request.nextUrl.searchParams
    const parsedParams = getTradesSchema.safeParse(Object.fromEntries(params.entries()))

    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsedParams.error.format() }, { status: 400 })
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
    const response = NextResponse.json(payload)
    Object.entries(CacheHeaders.privateShort).forEach(([key, value]) => response.headers.set(key, value))

    logger.info({ latencyMs: Date.now() - start, total: payload.trades?.length ?? 0, layer: 'api' }, 'GET /api/v1/trades')
    return response
  } catch (error: any) {
    Sentry.captureException(error, { extra: { route: '/api/v1/trades' } })
    logger.error({ error: error?.message, latencyMs: Date.now() - start, layer: 'api' }, 'GET /api/v1/trades failed')
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message?.includes('User not found')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
