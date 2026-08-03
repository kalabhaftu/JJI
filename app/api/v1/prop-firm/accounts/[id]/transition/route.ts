import { NextRequest, NextResponse } from 'next/server'
import { reportApiHandlerError, withCanonicalApiResponse } from '@/lib/api/canonical-handler'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { z } from 'zod'
import { advancePropFirmPhaseForUser } from '@/server/accounts/phase-progression'
import { isDomainError } from '@/lib/domain-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'

interface RouteParams {
  params: Promise<{ id: string }>
}


const PhaseTransitionSchema = z.object({
  nextPhaseId: z.string().min(1, 'Next phase ID is required')
})


async function transitionPropFirmAccount(request: NextRequest, { params }: RouteParams) {
  const rateLimitRes = await applyApiRoutePolicy(request)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const internalUserId = identity.internalUserId

    const { id: masterAccountId } = await params

    const body = await request.json()
    const { nextPhaseId } = PhaseTransitionSchema.parse(body)
    const { nextPhaseName, ...result } = await advancePropFirmPhaseForUser({
      userId: internalUserId,
      masterAccountId,
      nextPhaseId,
      context: {
        source: 'api',
        requestId: resolveRequestId(request.headers),
        ipAddress: getClientIp(request.headers),
      },
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully transitioned to ${nextPhaseName}`
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      )
    }
    if (isDomainError(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      )
    }

    reportApiHandlerError(request, error, 'transition-prop-firm-phase')
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to transition phase'
      },
      { status: 500 }
    )
  }
}

export const POST = withCanonicalApiResponse(transitionPropFirmAccount)
