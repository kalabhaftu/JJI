import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { invalidateUserCaches } from '@/server/accounts'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, apiLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: accountId } = await params
    const internalUserId = identity.internalUserId
    const { newDate, isPropFirm, notificationId } = await request.json()

    if (!newDate) {
      return NextResponse.json(
        { success: false, error: 'New date is required' },
        { status: 400 }
      )
    }

    const adjustedDate = new Date(newDate)
    if (isNaN(adjustedDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format' },
        { status: 400 }
      )
    }

    if (isPropFirm) {
      await db
        .update(schema.MasterAccount)
        .set({ createdAt: adjustedDate })
        .where(
          and(
            eq(schema.MasterAccount.id, accountId),
            eq(schema.MasterAccount.userId, internalUserId)
          )
        )
    } else {
      await db
        .update(schema.Account)
        .set({ createdAt: adjustedDate })
        .where(
          and(
            eq(schema.Account.id, accountId),
            eq(schema.Account.userId, internalUserId)
          )
        )
    }

    if (notificationId) {
      await db
        .update(schema.Notification)
        .set({ isRead: true })
        .where(
          and(
            eq(schema.Notification.id, notificationId),
            eq(schema.Notification.userId, internalUserId)
          )
        )
    }

    await invalidateUserCaches(internalUserId)

    return NextResponse.json({
      success: true,
      message: 'Account creation date adjusted successfully'
    })
  } catch (error) {
    logger.error('Adjust account date error: ' + (error instanceof Error ? error.message : String(error)))
    return NextResponse.json(
      { success: false, error: 'Failed to adjust account date' },
      { status: 500 }
    )
  }
}