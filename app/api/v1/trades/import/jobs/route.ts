import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { createTradeImportJob } from '@/server/trade-import-jobs'
import { enqueueImportJob } from '@/server/import-job-events'
import { createErrorResponse, createSuccessResponse, ErrorResponses } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

const MAX_TRADE_IMPORT_ROWS = 5000
const MAX_TRADE_IMPORT_BODY_BYTES = 2 * 1024 * 1024

const tradeImportSchema = z.object({
  accountId: z.string().trim().min(1).max(128),
  trades: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_TRADE_IMPORT_ROWS),
}).strict()

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'import')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return ErrorResponses.unauthorized()
    }

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_TRADE_IMPORT_BODY_BYTES) {
      return createErrorResponse('Trade import payload is too large', 413)
    }

    const body = await request.json().catch(() => null)
    const parsed = tradeImportSchema.safeParse(body)

    if (!parsed.success) {
      return createErrorResponse('Validation failed', 400, parsed.error.flatten(), 'VALIDATION_ERROR')
    }

    const job = await createTradeImportJob({
      internalUserId: identity.internalUserId,
      accountId: parsed.data.accountId,
      trades: parsed.data.trades,
    })

    await enqueueImportJob({
      jobId: job.id,
      internalUserId: identity.internalUserId,
      kind: 'trade',
      requestId,
    })

    return createSuccessResponse(
      { job },
      'Import job created',
      undefined,
      requestId,
      { status: 201 },
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'create-trade-import-job',
      route: '/api/v1/trades/import/jobs',
      requestId,
    })
    return createErrorResponse('Failed to create trade import job', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
