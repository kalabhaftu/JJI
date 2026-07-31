import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { revalidateTag } from 'next/cache'

export async function POST(request: NextRequest) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const subscription = await db.query.Subscription.findFirst({
      where: (table, { eq }) => eq(table.userId, identity.internalUserId),
    })

    if (!subscription) {
      return NextResponse.json({ success: false, error: 'No subscription found' }, { status: 404 })
    }

    if (subscription.status === 'cancelled') {
      return NextResponse.json({ success: true, message: 'Subscription already cancelled' })
    }

    await (await db.update(schema.Subscription).set({
      status: 'cancelled',
      cancelledAt: new Date(),
    }).where(eq(schema.Subscription.id, subscription.id)).returning())[0]

    revalidateTag(`notifications-${identity.internalUserId}`)
    revalidateTag(`accounts-${identity.internalUserId}`)
    revalidateTag(`user-data-${identity.internalUserId}`)

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully',
    })
  } catch (error) {
    logger.error({ error, context: 'Payment Cancel' }, 'Cancel payment failed')
    return NextResponse.json(
      { success: false, error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}