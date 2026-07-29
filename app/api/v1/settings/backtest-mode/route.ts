import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'

// GET - Get backtest input mode preference
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'authenticated-read')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    const userId = identity?.internalUserId

    if (!userId) {
      return createSuccessResponse({ mode: 'manual' }, undefined, { fallback: true }, requestId)
    }

    const userSettings = await db.query.UserSettings.findFirst({
      where: (table, { eq }) => eq(table.userId, userId),
      columns: { backtestInputMode: true },
    })

    return createSuccessResponse({
      mode: userSettings?.backtestInputMode || 'manual' 
    }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'load-backtest-mode',
      route: request.nextUrl.pathname,
      requestId,
      extra: { fallbackUsed: true },
    })
    return createSuccessResponse({ mode: 'manual' }, undefined, { fallback: true }, requestId)
  }
}

// POST - Update backtest input mode preference
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    const userId = identity?.internalUserId

    if (!userId) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const { mode } = await request.json()

    if (!mode || !['manual', 'simple'].includes(mode)) {
      return createErrorResponse('Invalid mode', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    await db.insert(schema.UserSettings)
      .values({ userId, backtestInputMode: mode })
      .onConflictDoUpdate({
        target: schema.UserSettings.userId,
        set: { backtestInputMode: mode },
      })

    return createSuccessResponse({ mode }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'save-backtest-mode',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to update preference',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}
