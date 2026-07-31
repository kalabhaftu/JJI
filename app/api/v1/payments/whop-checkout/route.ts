/**
 * POST /api/v1/payments/whop-checkout
 *
 * Creates a Whop checkout URL for the authenticated user.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { resolveRequestId } from '@/lib/observability/request-id'
import { verifyAuth } from '@/server/user-identity'
import { createWhopCheckoutLink } from '@/lib/services/whop/checkout'
import { getUserAccessStatus } from '@/lib/services/subscription/access'

const CheckoutRequestSchema = z.object({
  planId: z.enum(['pro']),
})

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const body = await request.json()
    const result = CheckoutRequestSchema.safeParse(body)
    if (!result.success) {
      return createErrorResponse('Invalid request', 400, result.error.format(), 'VALIDATION_ERROR', requestId)
    }

    const { planId } = result.data

    // Check if user already has an active subscription to prevent double-billing
    const access = await getUserAccessStatus(auth.user.id, auth.user.role)
    if (access.hasAccess && access.status !== 'past_due') {
      return createErrorResponse(
        'You already have an active subscription.',
        409,
        undefined,
        'CONFLICT',
        requestId,
      )
    }

    const checkout = await createWhopCheckoutLink(auth.user.id, planId)

    return createSuccessResponse(checkout, undefined, undefined, requestId)
  } catch (error: any) {
    return createErrorResponse(
      error.message || 'Failed to create checkout link',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}
