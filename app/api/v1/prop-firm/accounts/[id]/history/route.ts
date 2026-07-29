import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { db } from '@/lib/db/client'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const internalUserId = identity.internalUserId

    const { id: masterAccountId } = await params

    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, masterAccountId), eq(table.userId, internalUserId)),
      with: {
        PhaseAccount: {
          orderBy: (table, { asc }) => [asc(table.phaseNumber)],
          with: {
            BreachRecord: {
              orderBy: (table, { desc }) => [desc(table.breachTime)],
            },
          },
        },
        Payout: {
          orderBy: (table, { desc }) => [desc(table.requestDate)],
        },
      },
    })

    if (!masterAccount) {
      return createErrorResponse('Master account not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    const events: any[] = []

    for (const phase of masterAccount.PhaseAccount) {
      events.push({
        type: 'phase_start',
        phaseNumber: phase.phaseNumber,
        date: phase.startDate,
        details: { status: phase.status, phaseId: phase.phaseId },
      })

      if (phase.endDate) {
        events.push({
          type: phase.status === 'passed' ? 'phase_passed' : 'phase_ended',
          phaseNumber: phase.phaseNumber,
          date: phase.endDate,
          details: { status: phase.status },
        })
      }

      for (const breach of phase.BreachRecord) {
        events.push({
          type: 'breach',
          phaseNumber: phase.phaseNumber,
          date: breach.breachTime,
          details: {
            breachType: breach.breachType,
            breachAmount: breach.breachAmount,
            currentEquity: breach.currentEquity,
          },
        })
      }
    }

    for (const payout of masterAccount.Payout) {
      events.push({
        type: 'payout',
        phaseNumber: null,
        date: payout.requestDate,
        details: {
          amount: payout.amount,
          status: payout.status,
          approvedDate: payout.approvedDate,
          paidDate: payout.paidDate,
        },
      })
    }

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return createSuccessResponse(
      {
        masterAccountId,
        accountName: masterAccount.accountName,
        propFirmName: masterAccount.propFirmName,
        events,
      },
      undefined,
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'get-prop-firm-account-history', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to fetch account history', 500, undefined, 'ACCOUNT_HISTORY_FAILED', requestId)
  }
}
