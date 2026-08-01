import { NextRequest } from 'next/server'
import { z } from 'zod'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getUserAccessStatus } from '@/lib/services/subscription/access'
import { createWhopCheckoutLink } from '@/lib/services/whop/checkout'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

const CheckoutRequestSchema = z.object({
  planId: z.literal('pro'),
})

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'payment')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const parsed = CheckoutRequestSchema.safeParse(
      await request.json().catch(() => null),
    )
    if (!parsed.success) {
      return createErrorResponse(
        'Validation failed',
        400,
        parsed.error.flatten(),
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const [access, user] = await Promise.all([
      getUserAccessStatus(identity.internalUserId),
      db.query.User.findFirst({
        where: (table, { eq }) => eq(table.id, identity.internalUserId),
        columns: { email: true },
      }),
    ])
    if (access.hasAccess && access.status !== 'past_due') {
      return createErrorResponse(
        'You already have active access.',
        409,
        undefined,
        'SUBSCRIPTION_ACTIVE',
        requestId,
      )
    }
    if (!user?.email) {
      return createErrorResponse(
        'Your account email is unavailable.',
        409,
        undefined,
        'CHECKOUT_EMAIL_MISSING',
        requestId,
      )
    }

    const checkout = await createWhopCheckoutLink({
      internalUserId: identity.internalUserId,
      email: user.email,
      planKey: parsed.data.planId,
      requestId,
    })

    return createSuccessResponse(checkout, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'create-whop-checkout',
      route: request.nextUrl.pathname,
      requestId,
      tags: { provider: 'whop' },
    })
    return createErrorResponse(
      'Failed to create card checkout',
      500,
      undefined,
      'WHOP_CHECKOUT_FAILED',
      requestId,
    )
  }
}
