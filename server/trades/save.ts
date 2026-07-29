import 'server-only'

import { revalidatePath } from 'next/cache'

import { buildBulkAuditSummary, recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { reportError } from '@/lib/observability/report-error'
import { buildTradePersistenceData } from '@/lib/trade-core'

type Trade = typeof schema.Trade.$inferSelect

export type SaveTradesError =
  | 'DUPLICATE_TRADES'
  | 'NO_TRADES_ADDED'
  | 'DATABASE_ERROR'
  | 'INVALID_DATA'
  | 'DATABASE_CONNECTION_ERROR'

export interface SaveTradesResult {
  error: SaveTradesError | false
  numberOfTradesAdded: number
  details?: unknown
}

export async function saveTradesForUser(
  internalUserId: string,
  data: Trade[],
  context: { requestId?: string; source?: 'api' | 'background-job' } = {},
): Promise<SaveTradesResult> {
  if (!internalUserId || !Array.isArray(data) || data.length === 0) {
    return {
      error: 'INVALID_DATA',
      numberOfTradesAdded: 0,
      details: 'No trades provided',
    }
  }

  try {
    const cleanedData = data.map((trade) => {
      const cleanTrade = Object.fromEntries(
        Object.entries(trade).filter(([, value]) => value !== undefined),
      ) as Partial<Trade>

      return buildTradePersistenceData({
        id: cleanTrade.id || crypto.randomUUID(),
        ...cleanTrade,
        accountNumber: cleanTrade.accountNumber || '',
        instrument: cleanTrade.instrument || '',
        entryPrice: cleanTrade.entryPrice || '',
        closePrice: cleanTrade.closePrice || '',
        entryDate: cleanTrade.entryDate || '',
        closeDate: cleanTrade.closeDate || '',
        quantity: cleanTrade.quantity ?? 0,
        pnl: cleanTrade.pnl || 0,
        timeInPosition: cleanTrade.timeInPosition || 0,
        userId: internalUserId,
        side: cleanTrade.side || '',
        commission: cleanTrade.commission || 0,
        entryId: cleanTrade.entryId || null,
        comment: cleanTrade.comment || null,
        groupId: cleanTrade.groupId || null,
        createdAt: cleanTrade.createdAt || new Date(),
      } as Trade) as Trade
    })

    const insertedCount = await db.transaction(async (tx) => {
      const insertedTrades = await tx.insert(schema.Trade)
        .values(cleanedData as any)
        .onConflictDoNothing()
        .returning({ id: schema.Trade.id })

      await recordAuditEvent({
        userId: internalUserId,
        action: 'TRADES_IMPORTED',
        entityType: 'Trade',
        entityId: `batch:${crypto.randomUUID()}`,
        source: context.source ?? 'api',
        ...(context.requestId ? { requestId: context.requestId } : {}),
        afterData: buildBulkAuditSummary({
          created: insertedTrades.length,
          skipped: cleanedData.length - insertedTrades.length,
          entityTypes: ['Trade'],
        }),
      }, tx as never)

      return insertedTrades.length
    })

    revalidatePath('/')
    return {
      error: false,
      numberOfTradesAdded: insertedCount,
      details: `Processed ${cleanedData.length} entries. ${insertedCount} new trades added.`,
    }
  } catch (error) {
    reportError(error, {
      surface: context.source === 'background-job' ? 'background-job' : 'server',
      operation: 'save-trades',
      userId: internalUserId,
      ...(context.requestId ? { requestId: context.requestId } : {}),
      extra: { tradeCount: data.length },
    })

    if (
      error instanceof Error
      && (
        error.message.includes("Can't reach database server")
        || error.message.includes('P1001')
        || error.message.includes('Connection timeout')
        || error.message.includes('ECONNREFUSED')
        || error.message.includes('ENOTFOUND')
      )
    ) {
      return {
        error: 'DATABASE_CONNECTION_ERROR',
        numberOfTradesAdded: 0,
        details: 'Database is temporarily unavailable. Please try again.',
      }
    }

    return {
      error: 'DATABASE_ERROR',
      numberOfTradesAdded: 0,
      details: 'Failed to save trades',
    }
  }
}
