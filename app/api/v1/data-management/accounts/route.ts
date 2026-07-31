import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { TRADE_COUNT_SELECT, buildGroupedTradeCountSummary } from '@/lib/trade-counts'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, apiLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const internalUserId = identity.internalUserId

    // 1. Fetch ALL LIVE accounts (unfiltered)
    const liveAccounts = await db.query.Account.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      orderBy: (table, { desc }) => [desc(table.createdAt)]
    });

    // 2. Fetch ALL PROP FIRM accounts (unfiltered)
    const propFirmAccounts = await db.query.MasterAccount.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      with: { PhaseAccount: { orderBy: (table, { asc }) => [asc(table.phaseNumber)] } }
    });

    // 3. Fetch all trades once and build grouped execution counts
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

    // 4. Normalize to UnifiedAccount schema (Unfiltered)
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
          // EXCLUDE 'pending' and 'pending_approval' per user request
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
    logger.error('Data management accounts API failed', error, 'Data Management Accounts')
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}