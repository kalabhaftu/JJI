import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { buildGroupedTradeCountSummary } from '@/lib/trade-counts'
import { buildSyntheticExecutionsFromTrade, buildTradePersistenceData } from '@/lib/trade-core'
import { classifyOutcome } from '@/lib/metrics/outcome'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { getRuntimeBreakEvenThreshold } from '@/server/user-settings'
import { enqueuePhaseEvaluation } from '@/server/phase-evaluation-events'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Validation schema for adding a trade
const AddTradeSchema = z.object({
  accountNumber: z.string(),
  quantity: z.number(),
  instrument: z.string(),
  entryPrice: z.string(),
  closePrice: z.string(),
  entryDate: z.string(),
  closeDate: z.string(),
  pnl: z.number(),
  commission: z.number().default(0),
  side: z.string().optional(),
  comment: z.string().optional(),
  symbol: z.string().optional(),
  entryTime: z.string().optional(),
  exitTime: z.string().optional()
})

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const body = await request.json()
    const tradeData = AddTradeSchema.parse(body)

    // Get the master account with its phases
    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, masterAccountId), eq(table.userId, internalUserId)),
      with: {
        PhaseAccount: true
      }
    })

    if (!masterAccount) {
      return NextResponse.json(
        { success: false, error: 'Master account not found or unauthorized' },
        { status: 404 }
      )
    }

    // Find the current phase (regardless of status)
    const currentPhase = masterAccount.PhaseAccount.find(
      (phase: (typeof masterAccount.PhaseAccount)[number]) =>
        phase.phaseNumber === masterAccount.currentPhase
    )

    if (!currentPhase) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No phase found for the current phase number. Please check your account configuration.' 
        },
        { status: 400 }
      )
    }
    
    // Don't allow adding trades to failed or archived phases
    if (currentPhase.status === 'failed' || currentPhase.status === 'archived') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot add trades to a ${currentPhase.status} phase. This phase is no longer active.` 
        },
        { status: 403 }
      )
    }

    // Check if the phase account has a phaseId set
    if (!currentPhase.phaseId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Please set the ID for the current phase before adding trades.' 
        },
        { status: 403 }
      )
    }

    // Create the trade
    const tradePayload = buildTradePersistenceData({
      id: crypto.randomUUID(),
      ...tradeData,
      userId: internalUserId,
      phaseAccountId: currentPhase.id,
      accountNumber: currentPhase.phaseId, // Use the phase account ID as account number
      entryTime: tradeData.entryTime ? new Date(tradeData.entryTime) : null,
      exitTime: tradeData.exitTime ? new Date(tradeData.exitTime) : null
    } as any)

    const trade = await db.transaction(async (tx) => {
      const createdTrade = (await tx.insert(schema.Trade).values(tradePayload as any).returning())[0]

      await tx.insert(schema.TradeExecution).values(buildSyntheticExecutionsFromTrade(tradePayload as any) as any)

      return createdTrade
    })

    await enqueuePhaseEvaluation({
      source: 'prop-firm-trade-created',
      masterAccountId,
      phaseAccountId: currentPhase.id,
    })

    return NextResponse.json({
      success: true,
      data: trade,
      evaluation: null,
      evaluationQueued: true,
      message: 'Trade added successfully'
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

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add trade' 
      },
      { status: 500 }
    )
  }
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
    const { searchParams } = new URL(request.url)
    
    // NEW: Support phase filtering via query params
    // ?phase=current (default) - only active phase
    // ?phase=all - all phases
    // ?phase=1 - specific phase number
    // ?phase=archived - only archived phases
    const phaseFilter = searchParams.get('phase') || 'current'

    // Verify the master account exists and belongs to the user
    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, masterAccountId), eq(table.userId, internalUserId)),
      with: {
        PhaseAccount: {
          with: {
            Trade: {
              orderBy: (table, { desc }) => [desc(table.exitTime)]
            }
          }
        }
      }
    })

    if (!masterAccount) {
      return NextResponse.json(
        { success: false, error: 'Master account not found or unauthorized' },
        { status: 404 }
      )
    }

    // FIXED: Filter phases based on query parameter
    let phasesToInclude = masterAccount.PhaseAccount
    
    if (phaseFilter === 'current') {
      // Only show trades from the current phase (regardless of status: active, passed, or failed)
      phasesToInclude = masterAccount.PhaseAccount.filter(
        (phase: (typeof masterAccount.PhaseAccount)[number]) =>
          phase.phaseNumber === masterAccount.currentPhase
      )
    } else if (phaseFilter === 'archived') {
      // Only show trades from archived phases
      phasesToInclude = masterAccount.PhaseAccount.filter(
        (phase: (typeof masterAccount.PhaseAccount)[number]) => phase.status === 'archived'
      )
    } else if (phaseFilter !== 'all') {
      // Specific phase number requested
      const requestedPhaseNumber = parseInt(phaseFilter)
      if (!isNaN(requestedPhaseNumber)) {
        phasesToInclude = masterAccount.PhaseAccount.filter(
          (phase: (typeof masterAccount.PhaseAccount)[number]) =>
            phase.phaseNumber === requestedPhaseNumber
        )
      }
    }
    // else: phaseFilter === 'all', use all phases

    // Flatten then group trades from filtered phases so every UI "trade" means a grouped execution
    const rawTrades = phasesToInclude.flatMap((phase: (typeof masterAccount.PhaseAccount)[number]) =>
      phase.Trade.map((trade: (typeof phase.Trade)[number]) => ({
        ...trade,
        phase: {
          id: phase.id,
          phaseNumber: phase.phaseNumber,
          phaseId: phase.phaseId,
          status: phase.status
        }
      }))
    )
    const groupedSummary = buildGroupedTradeCountSummary(rawTrades as any)
    const trades = groupedSummary.groupedTrades
    const breakEvenThreshold = await getRuntimeBreakEvenThreshold(internalUserId)
    const statistics = trades.reduce(
      (acc, trade) => {
        const pnl = getTradeNetPnl(trade)
        acc.totalPnl += pnl

        const outcome = classifyOutcome(pnl, breakEvenThreshold)
        if (outcome === 'win') acc.winningTrades += 1
        else if (outcome === 'loss') acc.losingTrades += 1
        else acc.breakEvenTrades += 1

        return acc
      },
      {
        totalTrades: trades.length,
        winningTrades: 0,
        losingTrades: 0,
        breakEvenTrades: 0,
        winRate: 0,
        totalPnl: 0,
      }
    )
    const tradableTradesCount = statistics.winningTrades + statistics.losingTrades
    statistics.winRate = tradableTradesCount > 0
      ? Math.round((statistics.winningTrades / tradableTradesCount) * 1000) / 10
      : 0

    return NextResponse.json({
      success: true,
      data: {
        masterAccount: {
          id: masterAccount.id,
          accountName: masterAccount.accountName,
          propFirmName: masterAccount.propFirmName,
          currentPhase: masterAccount.currentPhase
        },
        trades,
        statistics,
          filter: {
            applied: phaseFilter,
            availablePhases: masterAccount.PhaseAccount.map(
              (p: (typeof masterAccount.PhaseAccount)[number]) => ({
                phaseNumber: p.phaseNumber,
                status: p.status,
                tradeCount: buildGroupedTradeCountSummary(p.Trade as any).groupedTradeCount,
              })
            ),
          }
      }
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch trades' 
      },
      { status: 500 }
    )
  }
}
