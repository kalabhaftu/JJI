import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { enqueuePhaseEvaluation } from '@/server/phase-evaluation-events'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function resolveActivePhase(masterAccountId: string, userId: string) {
  const masterAccount = await db.query.MasterAccount.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.id, masterAccountId),
      operators.eq(table.userId, userId),
      operators.ne(table.status, 'failed'),
    ),
    with: {
      PhaseAccount: {
        where: (table, operators) => operators.eq(table.status, 'active'),
        orderBy: (table, operators) => [operators.asc(table.phaseNumber)],
        limit: 1,
      },
    },
  })
  return {
    masterAccount,
    activePhase: masterAccount?.PhaseAccount[0] ?? null,
  }
}

async function queueOwnedEvaluation(
  request: NextRequest,
  params: RouteParams['params'],
  source: string,
) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const { id: masterAccountId } = await params
    const { masterAccount, activePhase } = await resolveActivePhase(
      masterAccountId,
      identity.internalUserId,
    )
    if (!masterAccount) {
      return createErrorResponse(
        'Master account not found',
        404,
        undefined,
        'NOT_FOUND',
        requestId,
      )
    }
    if (!activePhase) {
      return createErrorResponse(
        'No active phase found',
        409,
        undefined,
        'NO_ACTIVE_PHASE',
        requestId,
      )
    }

    await enqueuePhaseEvaluation({
      source,
      masterAccountId,
      phaseAccountId: activePhase.id,
      requestId,
    })
    return createSuccessResponse({
      masterAccountId,
      phaseAccountId: activePhase.id,
      phaseNumber: activePhase.phaseNumber,
      evaluation: null,
      queued: true,
    }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'queue-phase-evaluation',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to queue phase evaluation',
      500,
      undefined,
      'PHASE_EVALUATION_QUEUE_FAILED',
      requestId,
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return queueOwnedEvaluation(request, params, 'manual-api')
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return queueOwnedEvaluation(request, params, 'manual-status-api')
}
