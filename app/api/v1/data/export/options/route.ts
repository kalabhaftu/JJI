import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

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
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
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

    return createSuccessResponse(
      {
        accounts,
        instruments,
      },
      undefined,
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'load-export-options', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to load export options', 500, undefined, 'EXPORT_OPTIONS_FAILED', requestId)
  }
}
