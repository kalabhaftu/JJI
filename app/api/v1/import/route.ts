import { NextRequest } from 'next/server'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import { createTradeImportJob } from '@/server/trade-import-jobs'
import { enqueueImportJob } from '@/server/import-job-events'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { z } from 'zod'

export const maxDuration = 60

const MAX_TRADE_IMPORT_ROWS = 5000
const MAX_TRADE_IMPORT_BODY_BYTES = 5 * 1024 * 1024

const tradeImportSchema = z.object({
  accountId: z.string().trim().min(1).max(128),
  trades: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_TRADE_IMPORT_ROWS),
}).strict()

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'import')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const jobs = await db.query.ImportJob.findMany({
      where: (table, { eq }) => eq(table.userId, identity.internalUserId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      columns: {
        id: true,
        status: true,
        stage: true,
        progress: true,
        totalItems: true,
        processedItems: true,
        importedCount: true,
        skippedCount: true,
        fileName: true,
        fileSize: true,
        error: true,
        cancelRequested: true,
        createdAt: true,
        completedAt: true,
      },
    })

    return createSuccessResponse(jobs, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'list-import-jobs',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to fetch import jobs', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'import')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
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
      operation: 'create-import-job',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to create trade import job', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
