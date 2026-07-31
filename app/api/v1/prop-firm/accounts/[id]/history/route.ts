import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
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
      return NextResponse.json(
        { success: false, error: 'Master account not found' },
        { status: 404 }
      )
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

    return NextResponse.json({
      success: true,
      data: {
        masterAccountId,
        accountName: masterAccount.accountName,
        propFirmName: masterAccount.propFirmName,
        events,
      },
    })
  } catch (error: any) {
    logger.error({ error: error?.message, context: 'api' }, 'GET /api/v1/prop-firm/accounts/[id]/history')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch account history' },
      { status: 500 }
    )
  }
}