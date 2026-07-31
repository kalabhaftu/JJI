import { NextRequest } from 'next/server'
import { z } from 'zod'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { createWhopCheckoutLink } from '@/lib/services/whop/checkout'
import { getUserAccessStatus } from '@/lib/services/subscription-service'

const CheckoutRequestSchema = z.object({
  planId: z.enum(['pro']),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await getResolvedUserIdentitySafe()
    if (!auth) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED')
    }

    const body = await request.json()
    const result = CheckoutRequestSchema.safeParse(body)
    if (!result.success) {
      return createErrorResponse('Invalid request', 400, result.error.format(), 'VALIDATION_ERROR')
    }

    const { planId } = result.data

    const access = await getUserAccessStatus(auth.internalUserId)
    if (access.hasAccess && access.status !== 'past_due') {
      return createErrorResponse(
        'You already have an active subscription.',
        409,
        undefined,
        'CONFLICT'
      )
    }

    const checkout = await createWhopCheckoutLink(auth.internalUserId, planId)

    return createSuccessResponse(checkout)
  } catch (error: any) {
    return createErrorResponse(
      'Failed to create checkout link',
      500,
      undefined,
      'INTERNAL_SERVER_ERROR'
    )
  }
}
