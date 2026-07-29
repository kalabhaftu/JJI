import { NextRequest } from 'next/server'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { id } = await params
    const body = await request.json()

    const notification = await db.query.Notification.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })

    if (!notification) {
      return createErrorResponse('Notification not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    const updated = (await db.update(schema.Notification).set({
      isRead: body.isRead ?? notification.isRead,
      actionRequired: body.actionRequired ?? notification.actionRequired,
    }).where(and(
      eq(schema.Notification.id, id),
      eq(schema.Notification.userId, internalUserId),
    )).returning())[0]

    return createSuccessResponse(updated, undefined, undefined, requestId)
  } catch (error: any) {
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    reportError(error, {
      surface: 'api',
      operation: 'update-notification',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to update notification', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { id } = await params

    const notification = await db.query.Notification.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })

    if (!notification) {
      return createErrorResponse('Notification not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    await db.delete(schema.Notification).where(and(
      eq(schema.Notification.id, id),
      eq(schema.Notification.userId, internalUserId),
    ))

    return createSuccessResponse(
      { deleted: true },
      'Notification deleted',
      undefined,
      requestId,
    )
  } catch (error: any) {
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    reportError(error, {
      surface: 'api',
      operation: 'delete-notification',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to delete notification', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
