import { NextRequest } from 'next/server'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { eq, and, desc, count } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'authenticated-read')
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const notifications = await db.query.Notification.findMany({
      where: (table, { eq, and }) => unreadOnly
        ? and(eq(table.userId, internalUserId), eq(table.isRead, false))
        : eq(table.userId, internalUserId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit,
    })

    let unreadCount: number
    if (unreadOnly) {
      unreadCount = notifications.length
    } else {
      const result = await db
        .select({ count: count() })
        .from(schema.Notification)
        .where(and(eq(schema.Notification.userId, internalUserId), eq(schema.Notification.isRead, false)))
      unreadCount = result[0]?.count || 0
    }

    return createSuccessResponse({ notifications, unreadCount }, undefined, undefined, requestId)
  } catch (error: any) {
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    reportError(error, {
      surface: 'api',
      operation: 'list-notifications',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to fetch notifications', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const body = await request.json()
    const { type, title, message, priority, data } = body

    if (!type || !title || !message) {
      return createErrorResponse(
        'Missing required fields: type, title, message',
        400,
        undefined,
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const notification = (await db.insert(schema.Notification).values({
      userId: internalUserId,
      type,
      title: String(title).slice(0, 200),
      message: String(message).slice(0, 1000),
      priority: priority || 'MEDIUM',
      ...(data ? { data } : {}),
    }).returning())[0]

    try {
      const user = await db.query.User.findFirst({
        where: (table, { eq }) => eq(table.id, internalUserId),
        columns: { fcmToken: true },
      })
      if (user?.fcmToken) {
        const { messaging } = await import('@/lib/firebase-admin')
        if (messaging) {
          await messaging.send({
            token: user.fcmToken,
            notification: {
              title: title,
              body: message,
            },
            data: {
              type: String(type),
              notificationId: String(notification?.id || ''),
              ...(data ? { payload: JSON.stringify(data) } : {}),
            },
          }).catch((pushError: any) => {
            reportError(pushError, {
              surface: 'background-job',
              operation: 'send-notification-push',
              route: request.nextUrl.pathname,
              requestId,
              userId: internalUserId,
              ...(notification?.id ? { entityId: notification.id } : {}),
            })
          })
        }
      }
    } catch (pushError: any) {
      reportError(pushError, {
        surface: 'background-job',
        operation: 'send-notification-push',
        route: request.nextUrl.pathname,
        requestId,
        userId: internalUserId,
        ...(notification?.id ? { entityId: notification.id } : {}),
      })
    }

    return createSuccessResponse(notification, undefined, undefined, requestId, { status: 201 })
  } catch (error: any) {
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    reportError(error, {
      surface: 'api',
      operation: 'create-notification',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to create notification', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()

    await db.update(schema.Notification)
      .set({ isRead: true })
      .where(and(eq(schema.Notification.userId, internalUserId), eq(schema.Notification.isRead, false)))

    return createSuccessResponse(
      { updated: true },
      'All notifications marked as read',
      undefined,
      requestId,
    )
  } catch (error: any) {
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    reportError(error, {
      surface: 'api',
      operation: 'mark-notifications-read',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to mark notifications as read', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()

    await db.delete(schema.Notification).where(eq(schema.Notification.userId, internalUserId))

    return createSuccessResponse(
      { deleted: true },
      'All notifications cleared',
      undefined,
      requestId,
    )
  } catch (error: any) {
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    reportError(error, {
      surface: 'api',
      operation: 'clear-notifications',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to clear notifications', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
