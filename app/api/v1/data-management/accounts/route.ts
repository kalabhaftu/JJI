import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { TRADE_COUNT_SELECT, buildGroupedTradeCountSummary } from '@/lib/trade-counts'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import * as schema from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { resolveRequestId } from '@/lib/observability/request-id'
import { reportError } from '@/lib/observability/report-error'
import { recordAuditEvent } from '@/lib/audit-logger'
import { getClientIp } from '@/lib/security/client-ip'
import { invalidateUserAccountCaches } from '@/server/accounts/cache'

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyApiRoutePolicy(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const internalUserId = identity.internalUserId


    const liveAccounts = await db.query.Account.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      orderBy: (table, { desc }) => [desc(table.createdAt)]
    });


    const propFirmAccounts = await db.query.MasterAccount.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      with: { PhaseAccount: { orderBy: (table, { asc }) => [asc(table.phaseNumber)] } }
    });


    const allTrades = await db.query.Trade.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      columns: TRADE_COUNT_SELECT,
    })
    const groupedCounts = buildGroupedTradeCountSummary(allTrades as any)

    const isFundedPhase = (evaluationType: string, phaseNumber: number): boolean => {
      switch (evaluationType) {
        case 'Two Step': return phaseNumber >= 3
        case 'One Step': return phaseNumber >= 2
        case 'Instant': return phaseNumber >= 1
        default: return phaseNumber >= 3
      }
    }


    const unified: any[] = []

    liveAccounts.forEach(acc => {
      unified.push({
        id: acc.id,
        number: acc.number,
        name: acc.name,
        propfirm: '',
        broker: acc.broker,
        startingBalance: acc.startingBalance,
        accountType: 'live',
        displayName: acc.name || acc.number,
        tradeCount: groupedCounts.groupedCountByLiveAccountNumber.get(acc.number) || 0,
        status: 'active',
        currentPhase: null,
        createdAt: acc.createdAt,
        isArchived: acc.isArchived || false,
        currentPhaseDetails: null,
      })
    })

    propFirmAccounts.forEach(master => {
      if (master.PhaseAccount && master.PhaseAccount.length > 0) {
        master.PhaseAccount.forEach((phase: any) => {

          if (phase.status === 'pending' || phase.status === 'pending_approval') {
            return
          }

          unified.push({
            id: phase.id,
            number: phase.phaseId || `PENDING-${phase.id.slice(0, 8)}`,
            name: master.accountName,
            propfirm: master.propFirmName,
            broker: undefined,
            startingBalance: phase.accountSize || master.accountSize,
            accountType: 'prop-firm',
            displayName: `${master.accountName} (${isFundedPhase(master.evaluationType, phase.phaseNumber) ? 'Funded' : 'Phase ' + phase.phaseNumber})`,
            tradeCount: groupedCounts.groupedCountByPhaseAccountId.get(phase.id) || 0,
            status: phase.status,
            currentPhase: phase.phaseNumber,
            createdAt: phase.createdAt || master.createdAt,
            isArchived: master.isArchived || false,
            currentPhaseDetails: {
              phaseNumber: phase.phaseNumber,
              status: phase.status,
              phaseId: phase.phaseId,
              masterAccountId: master.id,
              evaluationType: master.evaluationType
            }
          })
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: unified,
    })

  } catch (error: any) {
    reportError(error, {
      surface: 'api',
      operation: 'list-data-management-accounts',
      route: request.nextUrl.pathname,
      requestId: resolveRequestId(request.headers),
    })
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const body = await request.json().catch(() => null)
    const oldAccountNumber = typeof body?.oldAccountNumber === 'string'
      ? body.oldAccountNumber.trim()
      : ''
    const newAccountNumber = typeof body?.newAccountNumber === 'string'
      ? body.newAccountNumber.trim()
      : ''

    if (!oldAccountNumber || !newAccountNumber || newAccountNumber.length > 128) {
      return createErrorResponse(
        'Valid old and new account numbers are required',
        400,
        undefined,
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const existing = await db.query.Account.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.number, oldAccountNumber),
        operators.eq(table.userId, identity.internalUserId),
      ),
    })
    if (!existing) {
      return createErrorResponse('Account not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    const duplicate = await db.query.Account.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.number, newAccountNumber),
        operators.eq(table.userId, identity.internalUserId),
      ),
      columns: { id: true },
    })
    if (duplicate) {
      return createErrorResponse(
        'You already have an account with this number',
        409,
        undefined,
        'ACCOUNT_NUMBER_CONFLICT',
        requestId,
      )
    }

    await db.transaction(async (tx) => {
      await tx.update(schema.Account)
        .set({ number: newAccountNumber })
        .where(and(
          eq(schema.Account.id, existing.id),
          eq(schema.Account.userId, identity.internalUserId),
        ))
      await tx.update(schema.Trade)
        .set({ accountNumber: newAccountNumber })
        .where(and(
          eq(schema.Trade.accountNumber, oldAccountNumber),
          eq(schema.Trade.userId, identity.internalUserId),
        ))
      await recordAuditEvent({
        userId: identity.internalUserId,
        action: 'ACCOUNT_NUMBER_CHANGED',
        entityType: 'Account',
        entityId: existing.id,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        beforeData: { accountNumber: oldAccountNumber },
        afterData: { accountNumber: newAccountNumber },
      }, tx as never)
    })

    await invalidateUserAccountCaches(identity.internalUserId, requestId)
    return createSuccessResponse(
      { id: existing.id, number: newAccountNumber },
      'Account renamed',
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'rename-account',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to rename account',
      500,
      undefined,
      'ACCOUNT_RENAME_FAILED',
      requestId,
    )
  }
}
