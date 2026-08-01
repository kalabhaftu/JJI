import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { recordAuditEvent } from '@/lib/audit-logger'
import { getClientIp } from '@/lib/security/client-ip'
import { cancelOwnedWhopMembershipAtPeriodEnd } from '@/lib/services/whop/cancellation'
import { getConfiguredWhopEnvironment } from '@/lib/services/whop/config'

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'payment')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const subscription = await db.query.Subscription.findFirst({
      where: (table, { eq }) => eq(table.userId, identity.internalUserId),
    })

    if (!subscription) {
      return createErrorResponse('No subscription found', 404, undefined, 'NOT_FOUND', requestId)
    }

    const whopEnvironment = getConfiguredWhopEnvironment()
    const whopMembership = whopEnvironment
      ? await db.query.WhopMembership.findFirst({
          where: and(
            eq(schema.WhopMembership.userId, identity.internalUserId),
            eq(schema.WhopMembership.environment, whopEnvironment),
          ),
          columns: { membershipId: true },
        })
      : undefined

    if (whopMembership) {
      const membership = await cancelOwnedWhopMembershipAtPeriodEnd({
        userId: identity.internalUserId,
        requestId,
      })
      return createSuccessResponse({
        cancelled: true,
        cancelAtPeriodEnd: membership.cancelAtPeriodEnd,
        currentPeriodEnd: membership.currentPeriodEnd,
      }, 'Your subscription will not renew.', undefined, requestId)
    }

    if (subscription.status === 'cancelled') {
      return createSuccessResponse(
        { alreadyCancelled: true },
        'Subscription already cancelled',
        undefined,
        requestId,
      )
    }

    await db.transaction(async (tx) => {
      await tx.update(schema.Subscription).set({
        status: 'cancelled',
        cancelledAt: new Date(),
      }).where(eq(schema.Subscription.id, subscription.id))
      await recordAuditEvent({
        userId: identity.internalUserId,
        action: 'SUBSCRIPTION_CANCELLED',
        entityType: 'Subscription',
        entityId: subscription.id,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        beforeData: { status: subscription.status },
        afterData: { status: 'cancelled' },
      }, tx as never)
    })

    revalidateTag(`notifications-${identity.internalUserId}`)
    revalidateTag(`accounts-${identity.internalUserId}`)
    revalidateTag(`user-data-${identity.internalUserId}`)

    return createSuccessResponse(
      { cancelled: true },
      'Subscription cancelled successfully',
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'cancel-subscription', route: request.nextUrl.pathname, requestId })
    return createErrorResponse(
      'Failed to cancel subscription',
      500,
      undefined,
      'SUBSCRIPTION_CANCEL_FAILED',
      requestId,
    )
  }
}
