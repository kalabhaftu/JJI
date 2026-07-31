import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { db } from '@/lib/db/client'
import { PaymentRecord } from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { getUserAccessStatus } from '@/lib/services/subscription-service'

export async function GET(request: NextRequest) {
  try {
    const auth = await getResolvedUserIdentitySafe()
    if (!auth) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED')
    }

    const access = await getUserAccessStatus(auth.internalUserId)

    let provider = 'none'
    let manageUrl = null
    let membershipId = null

    if (access.subscription) {
      const record = await db.query.PaymentRecord.findFirst({
        where: eq(PaymentRecord.subscriptionId, access.subscription.id),
        orderBy: (fields, { desc }) => [desc(fields.createdAt)],
      })

      if (record) {
        provider = record.provider ?? 'nowpayments'
        membershipId = record.whopMembershipId
        if (provider === 'whop') {
          manageUrl = 'https://whop.com/user/billing/'
        }
      }
    }

    return createSuccessResponse(
      {
        hasAccess: access.hasAccess,
        status: access.status,
        provider,
        manageUrl,
        membershipId,
        renewsAt: access.subscription?.nextPaymentDue ?? null,
        cancelAtPeriodEnd: access.subscription?.cancelledAt !== null && access.subscription?.cancelledAt !== undefined,
      }
    )
  } catch (error: any) {
    return createErrorResponse(
      error.message || 'Failed to get billing status',
      500,
      undefined,
      'SERVER_ERROR'
    )
  }
}
