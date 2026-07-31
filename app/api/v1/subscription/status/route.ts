import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { getUserAccessStatus } from '@/lib/services/subscription-service'
import { db } from '@/lib/db/client'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.query.User.findFirst({
      where: (table, { eq }) => eq(table.id, identity.internalUserId),
    })

    const access = await getUserAccessStatus(identity.internalUserId, user?.role ?? undefined)

    return NextResponse.json({
      success: true,
      data: {
        hasAccess: access.hasAccess,
        status: access.status,
        reason: access.reason,
        currentPeriodEnd: access.subscription?.currentPeriodEnd,
        nextPaymentDue: access.subscription?.nextPaymentDue,
      },
    })
  } catch (error) {
    logger.error({ error, layer: 'Subscription Status' }, 'Subscription status check failed')
    return NextResponse.json({ success: false, error: 'Failed to check status' }, { status: 500 })
  }
}