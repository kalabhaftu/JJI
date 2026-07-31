import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { eq, and, desc, count } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
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

    return NextResponse.json({ success: true, data: { notifications, unreadCount } })
  } catch (error: any) {
    logger.error('GET /api/v1/notifications' + ' : ' + error)
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const body = await request.json()
    const { type, title, message, priority, data } = body

    if (!type || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields: type, title, message' }, { status: 400 })
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
            logger.error('FCM messaging send fail' + ' : ' + pushError)
          })
        }
      }
    } catch (pushError: any) {
      logger.error('Failed to send push notification' + ' : ' + pushError)
    }

    return NextResponse.json({ success: true, data: notification })
  } catch (error: any) {
    logger.error('POST /api/v1/notifications' + ' : ' + error)
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()

    await db.update(schema.Notification)
      .set({ isRead: true })
      .where(and(eq(schema.Notification.userId, internalUserId), eq(schema.Notification.isRead, false)))

    return NextResponse.json({ success: true, message: 'All notifications marked as read' })
  } catch (error: any) {
    logger.error('PATCH /api/v1/notifications' + ' : ' + error)
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()

    await db.delete(schema.Notification).where(eq(schema.Notification.userId, internalUserId))

    return NextResponse.json({ success: true, message: 'All notifications cleared' })
  } catch (error: any) {
    logger.error('DELETE /api/v1/notifications' + ' : ' + error)
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to clear notifications' }, { status: 500 })
  }
}