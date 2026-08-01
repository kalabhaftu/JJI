import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
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
import { recordAuditEvent } from '@/lib/audit-logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'

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
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
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
      return createErrorResponse('Master account not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    // Find the current phase (regardless of status)
    const currentPhase = masterAccount.PhaseAccount.find(
      (phase: (typeof masterAccount.PhaseAccount)[number]) =>
        phase.phaseNumber === masterAccount.currentPhase
    )

    if (!currentPhase) {
      return createErrorResponse(
        'No phase found for the current phase number. Please check your account configuration.',
        409,
        undefined,
        'NO_ACTIVE_PHASE',
        requestId,
      )
    }
    
    // Don't allow adding trades to failed or archived phases
    if (currentPhase.status === 'failed' || currentPhase.status === 'archived') {
      return createErrorResponse(
        `Cannot add trades to a ${currentPhase.status} phase. This phase is no longer active.`,
        409,
        undefined,
        'PHASE_NOT_ACTIVE',
        requestId,
      )
    }

    // Check if the phase account has a phaseId set
    if (!currentPhase.phaseId) {
      return createErrorResponse(
        'Please set the ID for the current phase before adding trades.',
        409,
        undefined,
        'PHASE_ID_REQUIRED',
        requestId,
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
      if (!createdTrade) throw new Error('Prop-firm trade insert returned no record')

      await tx.insert(schema.TradeExecution).values(buildSyntheticExecutionsFromTrade(tradePayload as any) as any)
      await recordAuditEvent({
        userId: internalUserId,
        action: 'TRADE_CREATED',
        entityType: 'Trade',
        entityId: createdTrade.id,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        afterData: {
          masterAccountId,
          phaseAccountId: currentPhase.id,
          instrument: createdTrade.instrument,
          side: createdTrade.side,
          quantity: createdTrade.quantity,
          pnl: createdTrade.pnl,
          commission: createdTrade.commission,
        },
      }, tx as never)

      return createdTrade
    })

    await enqueuePhaseEvaluation({
      source: 'prop-firm-trade-created',
      masterAccountId,
      phaseAccountId: currentPhase.id,
      requestId,
    })

    return createSuccessResponse(
      trade,
      'Trade added successfully',
      { evaluation: null, evaluationQueued: true },
      requestId,
      { status: 201 },
    )

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(
        'Validation failed',
        400,
        error.flatten(),
        'VALIDATION_ERROR',
        requestId,
      )
    }

    reportError(error, {
      surface: 'api',
      operation: 'create-prop-firm-trade',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to add trade',
      500,
      undefined,
      'TRADE_CREATE_FAILED',
      requestId,
    )
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'authenticated-read')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
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
      return createErrorResponse('Master account not found', 404, undefined, 'NOT_FOUND', requestId)
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

    return createSuccessResponse({
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
    }, undefined, undefined, requestId)

  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'list-prop-firm-trades',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to fetch trades',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}
