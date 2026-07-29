import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { nanoid } from 'nanoid'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const requestId = resolveRequestId(req.headers)
  const rl = await applyApiRoutePolicy(req, 'authenticated-read')
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const goals = await db.query.UserGoal.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    })
    return createSuccessResponse(goals, undefined, undefined, requestId)
  } catch (err: any) {
    if (err.message?.includes('not authenticated') || err.message?.includes('Unauthorized')) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    reportError(err, {
      surface: 'api',
      operation: 'list-goals',
      route: req.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Internal server error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function POST(req: NextRequest) {
  const requestId = resolveRequestId(req.headers)
  const rl = await applyApiRoutePolicy(req, 'sensitive')
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const body = await req.json()
    const { title, description, metric, targetValue, period, startDate, endDate } = body

    if (!title || !metric || targetValue === undefined || targetValue === null || !period || !startDate) {
      return createErrorResponse('Missing required fields', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    const numericTargetValue = Number(targetValue)
    if (!Number.isFinite(numericTargetValue)) {
      return createErrorResponse('Target value must be a valid number', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    const goal = (await db.insert(schema.UserGoal).values({
      id: nanoid(),
      userId: internalUserId,
      title,
      description: description || null,
      metric,
      targetValue: numericTargetValue,
      currentValue: 0,
      period,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    }).returning())[0]

    return createSuccessResponse(goal, undefined, undefined, requestId, { status: 201 })
  } catch (err: any) {
    if (err.message?.includes('not authenticated') || err.message?.includes('Unauthorized')) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    reportError(err, {
      surface: 'api',
      operation: 'create-goal',
      route: req.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Internal server error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
