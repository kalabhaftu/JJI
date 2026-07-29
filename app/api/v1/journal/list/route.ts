import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { listDailyJournalEntries } from '@/server/daily-journal'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const accountId = searchParams.get('accountId')

    const journals = await listDailyJournalEntries(identity.internalUserId, {
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(accountId && accountId !== 'all' ? { accountId } : {}),
    })

    return createSuccessResponse({ journals }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'list-journal-entries',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to fetch journal entries',
      500,
      undefined,
      'JOURNAL_LIST_FAILED',
      requestId,
    )
  }
}
