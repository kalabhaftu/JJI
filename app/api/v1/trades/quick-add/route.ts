import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { randomUUID } from 'crypto'
import { logActivity } from '@/lib/activity-logger'
import { recordAuditEvent } from '@/lib/audit-logger'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { buildSyntheticExecutionsFromTrade, buildTradePersistenceData } from '@/lib/trade-core'
import { z } from 'zod'
import { invalidateTradesCache } from '@/lib/cache/invalidate-trade'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'

const QuickAddSchema = z.object({
  instrument: z.string().min(1, 'Instrument is required'),
  side: z.enum(['buy', 'sell', 'BUY', 'SELL']),
  pnl: z.union([z.number(), z.string().transform((val) => {
    const parsed = parseFloat(val)
    if (isNaN(parsed)) throw new Error('Invalid number')
    return parsed
  })]),
  entryDate: z.string().optional(),
  accountNumber: z.string().optional()
})

export async function POST(req: NextRequest) {
  const requestId = resolveRequestId(req.headers)
  const rateLimitResponse = await applyApiRoutePolicy(req, 'sensitive')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const internalUserId = identity.internalUserId
    const body = await req.json()
    
    const parseResult = QuickAddSchema.safeParse(body)
    if (!parseResult.success) {
      return createErrorResponse(
        'Validation failed',
        400,
        parseResult.error.flatten(),
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const { instrument, side, pnl, entryDate, accountNumber } = parseResult.data

    let targetAccount = accountNumber
    if (!targetAccount) {
      const firstAccount = await db.query.Account.findFirst({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        columns: { number: true }
      })
      targetAccount = firstAccount?.number
    }

    if (!targetAccount) {
      return createErrorResponse(
        'No trading account found. Please add an account first.',
        400,
        undefined,
        'ACCOUNT_REQUIRED',
        requestId,
      )
    }

    const now = new Date()
    const dateString = entryDate ? new Date(entryDate).toISOString() : now.toISOString()

    const tradePayload = buildTradePersistenceData({
      id: randomUUID(),
      instrument: instrument.toUpperCase(),
      side: side.toLowerCase(),
      pnl: parseFloat(String(pnl)),
      entryDate: dateString,
      closeDate: dateString,
      entryTime: new Date(dateString),
      exitTime: new Date(dateString),
      accountNumber: targetAccount,
      quantity: 1,
      entryPrice: '0',
      closePrice: '0',
      commission: 0,
      userId: internalUserId
    } as any)

    const trade = await db.transaction(async (tx) => {
      const createdTrade = (await tx.insert(schema.Trade).values(tradePayload as any).returning())[0]!

      await tx.insert(schema.TradeExecution).values(
        buildSyntheticExecutionsFromTrade(tradePayload as any) as any
      )
      await recordAuditEvent({
        userId: internalUserId,
        action: 'TRADE_CREATED',
        entityType: 'Trade',
        entityId: createdTrade.id,
        source: 'api',
        requestId,
        ipAddress: getClientIp(req.headers),
        afterData: {
          instrument: createdTrade.instrument,
          side: createdTrade.side,
          pnl: createdTrade.pnl,
          accountId: createdTrade.accountId,
          phaseAccountId: createdTrade.phaseAccountId,
        },
      }, tx as never)

      return createdTrade
    })

    logActivity({
      userId: internalUserId,
      action: 'TRADE_CREATED',
      entity: 'Trade',
      entityId: trade.id,
      metadata: { instrument, accountNumber: targetAccount },
      ipAddress: getClientIp(req.headers),
      requestId,
    })

    await invalidateTradesCache(internalUserId)

    return createSuccessResponse(trade, undefined, undefined, requestId, { status: 201 })
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'quick-add-trade',
      route: req.nextUrl.pathname,
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
