import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = resolveRequestId(req.headers)
  const rl = await applyApiRoutePolicy(req, 'sensitive')
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { id } = await params
    const body = await req.json()

    const goal = await db.query.UserGoal.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })
    if (!goal) return createErrorResponse('Not found', 404, undefined, 'NOT_FOUND', requestId)

    const currentValue = body.currentValue === undefined
      ? undefined
      : Number(body.currentValue)
    const targetValue = body.targetValue === undefined
      ? undefined
      : Number(body.targetValue)
    if (
      (currentValue !== undefined && !Number.isFinite(currentValue))
      || (targetValue !== undefined && !Number.isFinite(targetValue))
    ) {
      return createErrorResponse(
        'Goal values must be valid numbers',
        400,
        undefined,
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const updated = (await db.update(schema.UserGoal).set({
      ...(currentValue !== undefined && { currentValue }),
      ...(body.isCompleted !== undefined && {
        isCompleted: Boolean(body.isCompleted),
        completedAt: body.isCompleted ? new Date() : null,
      }),
      ...(body.title && { title: body.title }),
      ...(targetValue !== undefined && { targetValue }),
    }).where(and(
      eq(schema.UserGoal.id, id),
      eq(schema.UserGoal.userId, internalUserId),
    )).returning())[0]
    return createSuccessResponse(updated, undefined, undefined, requestId)
  } catch (err) {
    reportError(err, {
      surface: 'api',
      operation: 'update-goal',
      route: req.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Internal server error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return PATCH(req, { params } as any)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = resolveRequestId(req.headers)
  const rl = await applyApiRoutePolicy(req, 'sensitive')
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { id } = await params
    const goal = await db.query.UserGoal.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })
    if (!goal) return createErrorResponse('Not found', 404, undefined, 'NOT_FOUND', requestId)
    await db.delete(schema.UserGoal).where(and(
      eq(schema.UserGoal.id, id),
      eq(schema.UserGoal.userId, internalUserId),
    ))
    return createSuccessResponse({ deleted: true }, undefined, undefined, requestId)
  } catch (err) {
    reportError(err, {
      surface: 'api',
      operation: 'delete-goal',
      route: req.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Internal server error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
