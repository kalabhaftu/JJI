/**
 * Prop Firm Analytics API (v1)
 *
 * GET /api/v1/reports/propfirm
 *
 * Returns all funded/challenge account stats computed server-side.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { calculatePropFirmStatistics } from '@/lib/statistics/propfirm-statistics'
import { CacheHeaders } from '@/lib/api-cache-headers'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  const start = Date.now()
  try {
    const { internalUserId } = await getResolvedUserIdentity()

    const result = await calculatePropFirmStatistics(internalUserId)

    const response = NextResponse.json(result)
    Object.entries(CacheHeaders.privateShort).forEach(([k, v]) => response.headers.set(k, v))
    logger.info({ latencyMs: Date.now() - start, context: 'api' }, 'GET /api/v1/reports/propfirm')
    return response
  } catch (error: any) {
    logger.error('GET /api/v1/reports/propfirm failed' + ' : ' + error)
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
