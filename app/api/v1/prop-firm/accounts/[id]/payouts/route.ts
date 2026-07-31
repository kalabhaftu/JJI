import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Helper function to determine if a phase number represents the funded stage
 * based on the evaluation type.
 */
function isFundedPhase(evaluationType: string, phaseNumber: number): boolean {
  return isFundedPhaseForEvaluation(evaluationType, phaseNumber)
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
    // ID is pure masterAccountId (UUID), not composite

    // Get account and calculate eligibility
    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, masterAccountId), eq(table.userId, internalUserId)),
      with: {
        PhaseAccount: {
          where: (table, { inArray }) => inArray(table.status, ['active', 'passed', 'archived']),
          with: { 
            Trade: {
              columns: {
                pnl: true,
                commission: true,
                exitTime: true
              }
            }
          },
          orderBy: (table, { asc }) => [asc(table.phaseNumber)]
        }
      }
    })

    if (!masterAccount) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    // Get current phase
    const currentPhase = masterAccount.PhaseAccount.find(
      (p: (typeof masterAccount.PhaseAccount)[number]) =>
        p.phaseNumber === masterAccount.currentPhase
    )
    const isFunded = currentPhase && isFundedPhase(masterAccount.evaluationType, currentPhase.phaseNumber)

    let eligibility = null
    
    if (isFunded && currentPhase) {
      // Calculate basic eligibility
      const fundedDate = currentPhase.startDate || new Date()
      const daysSinceFunded = Math.floor((Date.now() - fundedDate.getTime()) / (1000 * 60 * 60 * 24))
      
      // Calculate net profit since funded
      const netProfit = currentPhase.Trade.reduce(
        (sum: number, trade: { pnl: number | null; commission: number | null }) =>
          sum + getTradeNetPnl({
            pnl: trade.pnl ?? undefined,
            commission: trade.commission ?? undefined,
          } as any),
        0
      )
      
      // Basic eligibility rules (customize as needed)
      const minDaysRequired = 14
      const minProfit = 100 // Minimum profit for payout
      const isEligible = daysSinceFunded >= minDaysRequired && netProfit >= minProfit
      
      // Calculate profit split amount (assuming 80% trader split)
      const profitSplitPercent = currentPhase.profitSplitPercent || 80
      const profitSplitAmount = netProfit * (profitSplitPercent / 100)

      eligibility = {
        isEligible,
        daysSinceFunded,
        daysSinceLastPayout: daysSinceFunded, // Simplified - would track actual last payout
        netProfitSinceLastPayout: netProfit,
        minDaysRequired,
        profitSplitAmount,
        blockers: !isEligible ? [
          ...(daysSinceFunded < minDaysRequired ? [`Must wait ${minDaysRequired - daysSinceFunded} more days`] : []),
          ...(netProfit < minProfit ? [`Need $${minProfit - netProfit} more profit`] : [])
        ] : []
      }
    }

    // Fetch actual payout history from database
    const payoutHistory = currentPhase ? await db.query.Payout.findMany({
      where: (table, { eq }) => eq(table.phaseAccountId, currentPhase.id),
      orderBy: (table, { desc }) => [desc(table.requestDate)]
    }) : []

    return NextResponse.json({
      success: true,
      data: {
        eligibility,
        history: payoutHistory
      }
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch payout data'
      },
      { status: 500 }
    )
  }
}