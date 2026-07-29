import 'server-only'

import { and, eq } from 'drizzle-orm'

import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { DomainError } from '@/lib/domain-error'

interface TradeMutationContext {
  requestId?: string
  ipAddress?: string | null
}

function auditSummary(trade: typeof schema.Trade.$inferSelect) {
  return {
    accountId: trade.accountId,
    phaseAccountId: trade.phaseAccountId,
    instrument: trade.instrument,
    side: trade.side,
    quantity: trade.quantity,
    pnl: trade.pnl,
    commission: trade.commission,
    entryDate: trade.entryDate,
    closeDate: trade.closeDate,
  }
}

export async function updateTradeForUser(
  userId: string,
  tradeId: string,
  changes: Partial<typeof schema.Trade.$inferInsert>,
  context: TradeMutationContext,
) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.Trade.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.id, tradeId),
        operators.eq(table.userId, userId),
      ),
    })
    if (!existing) throw new DomainError('Trade not found', 'NOT_FOUND', 404)

    const [updated] = await tx.update(schema.Trade)
      .set(changes)
      .where(and(
        eq(schema.Trade.id, tradeId),
        eq(schema.Trade.userId, userId),
      ))
      .returning()
    if (!updated) throw new DomainError('Trade not found', 'NOT_FOUND', 404)

    await recordAuditEvent({
      userId,
      action: 'TRADE_UPDATED',
      entityType: 'Trade',
      entityId: tradeId,
      source: 'api',
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      beforeData: auditSummary(existing),
      afterData: {
        ...auditSummary(updated),
        updatedFields: Object.keys(changes).sort(),
      },
    }, tx as never)
    return { existing, updated }
  })
}

export async function deleteTradeForUser(
  userId: string,
  tradeId: string,
  context: TradeMutationContext,
) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.Trade.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.id, tradeId),
        operators.eq(table.userId, userId),
      ),
    })
    if (!existing) throw new DomainError('Trade not found', 'NOT_FOUND', 404)

    const deleted = await tx.delete(schema.Trade)
      .where(and(
        eq(schema.Trade.id, tradeId),
        eq(schema.Trade.userId, userId),
      ))
      .returning({ id: schema.Trade.id })
    if (deleted.length === 0) {
      throw new DomainError('Trade not found', 'NOT_FOUND', 404)
    }

    await recordAuditEvent({
      userId,
      action: 'TRADE_DELETED',
      entityType: 'Trade',
      entityId: tradeId,
      source: 'api',
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      beforeData: auditSummary(existing),
    }, tx as never)
    return existing
  })
}
