/**
 * Report Statistics API (v1)
 * 
 * POST /api/v1/reports/stats
 * 
 * Replaces all client-side report calculations with a single server endpoint.
 * Accepts filter parameters and returns pre-computed report DTOs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { calculateReportStatistics, type ReportStatsFilters } from '@/lib/statistics/report-statistics'
import { CacheHeaders } from '@/lib/api-cache-headers'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const reportStatsRequestSchema = z.object({
  accountId: z.string().trim().max(128).optional(),
  accountNumbers: z.array(z.string().trim().min(1).max(128)).max(100).optional(),
  dateFrom: z.string().trim().max(64).optional(),
  dateTo: z.string().trim().max(64).optional(),
  symbol: z.string().trim().max(64).optional(),
  session: z.string().trim().max(32).optional(),
  outcome: z.string().trim().max(32).optional(),
  strategy: z.string().trim().max(128).optional(),
  ruleBroken: z.enum(['all', 'broken', 'not_broken']).optional(),
})

export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  const start = Date.now()
  try {
    const { internalUserId } = await getResolvedUserIdentity()

    const body = await request.json().catch(() => null)
    const parsed = reportStatsRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid report filters', details: parsed.error.flatten() }, { status: 400 })
    }

    const validated = parsed.data
    const filters: ReportStatsFilters = {
      userId: internalUserId,
      ...(validated.accountId ? { accountId: validated.accountId } : {}),
      ...(validated.accountNumbers ? { accountNumbers: validated.accountNumbers } : {}),
      ...(validated.dateFrom ? { dateFrom: validated.dateFrom } : {}),
      ...(validated.dateTo ? { dateTo: validated.dateTo } : {}),
      ...(validated.symbol ? { symbol: validated.symbol } : {}),
      ...(validated.session ? { session: validated.session } : {}),
      ...(validated.outcome ? { outcome: validated.outcome } : {}),
      ...(validated.strategy ? { strategy: validated.strategy } : {}),
      ...(validated.ruleBroken ? { ruleBroken: validated.ruleBroken } : {}),
    }

    const result = await calculateReportStatistics(filters)

    const response = NextResponse.json(result)
    Object.entries(CacheHeaders.privateShort).forEach(([k, v]) => response.headers.set(k, v))
    logger.info({ latencyMs: Date.now() - start, context: 'api' }, 'POST /api/v1/reports/stats')
    return response
  } catch (error: any) {
    logger.error('POST /api/v1/reports/stats failed' + ' : ' + error)
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
