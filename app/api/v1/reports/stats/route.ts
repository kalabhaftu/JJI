

import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { calculateReportStatistics, calculateDashboardAggregates, type ReportStatsFilters } from '@/lib/statistics/report-statistics'
import { CacheHeaders } from '@/lib/api-cache-headers'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

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
  dashboard: z.boolean().optional(),
  accountIds: z.array(z.string().trim().min(1).max(128)).max(100).optional(),
  from: z.string().trim().max(64).optional(),
  to: z.string().trim().max(64).optional(),
  timezone: z.string().trim().max(64).optional(),
  currency: z.string().trim().max(16).optional(),
  includeFees: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  const start = Date.now()
  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const body = await request.json().catch(() => null)
    const parsed = reportStatsRequestSchema.safeParse(body)
    if (!parsed.success) {
      return createErrorResponse('Invalid report filters', 400, parsed.error.flatten(), 'VALIDATION_ERROR', requestId)
    }

    const validated = parsed.data

    if (validated.dashboard) {
      const aggregates = await calculateDashboardAggregates({
        userId: identity.internalUserId,
        accountIds: validated.accountIds ?? [],
        from: validated.from ?? '1970-01-01',
        to: validated.to ?? '2099-12-31',
        timezone: validated.timezone ?? 'UTC',
        ...(validated.currency ? { currency: validated.currency } : {}),
        includeFees: validated.includeFees ?? false,
      })

      logger.info({ latencyMs: Date.now() - start, context: 'api' }, 'POST /api/v1/reports/stats (dashboard aggregates)')
      return createSuccessResponse(aggregates, undefined, undefined, requestId, {
        headers: CacheHeaders.privateShort,
      })
    }

    const filters: ReportStatsFilters = {
      userId: identity.internalUserId,
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

    logger.info({ latencyMs: Date.now() - start, context: 'api' }, 'POST /api/v1/reports/stats')
    return createSuccessResponse(result, undefined, undefined, requestId, {
      headers: CacheHeaders.privateShort,
    })
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'calculate-report-statistics', route: request.nextUrl.pathname, requestId })
    return createErrorResponse(
      'Internal server error',
      500,
      undefined,
      'REPORT_STATISTICS_FAILED',
      requestId,
    )
  }
}
