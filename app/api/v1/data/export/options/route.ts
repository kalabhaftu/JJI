import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger';

function getPhaseLabel(evaluationType: string, phaseNumber: number) {
  switch (evaluationType) {
    case 'Two Step':
      return phaseNumber >= 3 ? 'Funded' : `Phase ${phaseNumber}`
    case 'One Step':
      return phaseNumber >= 2 ? 'Funded' : `Phase ${phaseNumber}`
    case 'Instant':
      return phaseNumber >= 1 ? 'Funded' : `Phase ${phaseNumber}`
    default:
      return `Phase ${phaseNumber}`
  }
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, apiLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const internalUserId = identity.internalUserId

    const [liveAccounts, masterAccounts, instrumentRows] = await Promise.all([
      db.query.Account.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        columns: {
          id: true,
          number: true,
          name: true,
          isArchived: true,
        },
      }),
      db.query.MasterAccount.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        columns: {
          id: true,
          accountName: true,
          propFirmName: true,
          evaluationType: true,
          isArchived: true,
        },
        with: {
          PhaseAccount: {
            columns: {
              id: true,
              phaseNumber: true,
              phaseId: true,
              status: true,
            },
            orderBy: (table, { asc }) => [asc(table.phaseNumber)],
          },
        },
      }),
      db.query.Trade.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        columns: { instrument: true },
      }),
    ])

    const live = liveAccounts.map((account) => ({
      id: account.id,
      number: account.number,
      name: account.name || account.number,
      displayName: account.name || account.number,
      accountType: 'live' as const,
      status: 'active',
      isArchived: !!account.isArchived,
    }))

    const propPhases = masterAccounts.flatMap((master) =>
      master.PhaseAccount.map((phase) => ({
        id: phase.id,
        number: phase.phaseId || `PHASE-${phase.phaseNumber}`,
        name: master.accountName,
        displayName: `${master.accountName} (${getPhaseLabel(master.evaluationType, phase.phaseNumber)})`,
        accountType: 'prop-firm' as const,
        status: phase.status,
        isArchived: !!master.isArchived,
        masterAccountId: master.id,
        propFirmName: master.propFirmName,
      }))
    )

    const accounts = [...live, ...propPhases].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    )

    const instruments = instrumentRows
      .map((row) => row.instrument)
      .filter((instrument): instrument is string => !!instrument && instrument.trim().length > 0)
      .sort((a, b) => a.localeCompare(b))

    return NextResponse.json({
      success: true,
      data: {
        accounts,
        instruments,
      },
    })
  } catch (error) {
    logger.error('[API] /api/v1/data/export/options error: ' + (error instanceof Error ? error.message : String(error)))
    return NextResponse.json(
      { success: false, error: 'Failed to load export options' },
      { status: 500 }
    )
  }
}