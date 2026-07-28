import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { id } = await params
    const body = await request.json()

    const notification = await db.query.Notification.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const updated = (await db.update(schema.Notification).set({
      isRead: body.isRead ?? notification.isRead,
      actionRequired: body.actionRequired ?? notification.actionRequired,
    }).where(and(
      eq(schema.Notification.id, id),
      eq(schema.Notification.userId, internalUserId),
    )).returning())[0]

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    logger.error({ error: error?.message, context: 'api' }, 'PATCH /api/v1/notifications/[id]')
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { id } = await params

    const notification = await db.query.Notification.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    await db.delete(schema.Notification).where(and(
      eq(schema.Notification.id, id),
      eq(schema.Notification.userId, internalUserId),
    ))

    return NextResponse.json({ success: true, message: 'Notification deleted' })
  } catch (error: any) {
    logger.error({ error: error?.message, context: 'api' }, 'DELETE /api/v1/notifications/[id]')
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
  }
}
