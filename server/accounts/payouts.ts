import { and, eq, sql } from 'drizzle-orm'

import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'
import { NotificationService } from '@/server/services/notification-service'
import { invalidateUserAccountCaches } from '@/server/accounts/cache'
import { DomainError } from '@/lib/domain-error'
import { reportError } from '@/lib/observability/report-error'

export interface PayoutRequestInput {
  masterAccountId: string
  phaseAccountId: string
  amount: number
  requestDate?: Date
  notes?: string
}

export interface AccountMutationContext {
  requestId?: string
  ipAddress?: string | null
  source: 'api' | 'server-action' | 'background-job'
}

export async function savePayoutForUser(
  userId: string,
  payout: PayoutRequestInput,
  context: AccountMutationContext,
) {
  if (!payout.masterAccountId || !payout.phaseAccountId) {
    throw new DomainError(
      'Missing required payout fields: masterAccountId and phaseAccountId are required',
      'VALIDATION_ERROR',
    )
  }
  if (!Number.isFinite(payout.amount) || payout.amount <= 0) {
    throw new DomainError('Payout amount must be greater than 0', 'VALIDATION_ERROR')
  }

  const masterAccount = await db.query.MasterAccount.findFirst({
    where: (table, { and, eq }) => and(
      eq(table.id, payout.masterAccountId),
      eq(table.userId, userId),
    ),
    with: {
      PhaseAccount: {
        where: (table, { eq }) => eq(table.id, payout.phaseAccountId),
      },
    },
  })
  if (!masterAccount) throw new DomainError('Master account not found', 'NOT_FOUND', 404)

  const phaseAccount = masterAccount.PhaseAccount[0]
  if (!phaseAccount) throw new DomainError('Phase account not found', 'NOT_FOUND', 404)
  if (!isFundedPhaseForEvaluation(
    masterAccount.evaluationType,
    phaseAccount.phaseNumber,
  )) {
    throw new DomainError(
      `Payouts can only be requested for Funded accounts. This account is currently in Phase ${phaseAccount.phaseNumber}.`,
      'PAYOUT_NOT_FUNDED',
      409,
    )
  }
  if (phaseAccount.status !== 'active') {
    throw new DomainError(
      `Cannot request payout for ${phaseAccount.status} account. Account must be active.`,
      'PAYOUT_ACCOUNT_INACTIVE',
      409,
    )
  }

  const newPayout = await db.transaction(async (tx) => {
    await tx.execute(sql`
      select ${schema.PhaseAccount.id}
      from ${schema.PhaseAccount}
      where ${schema.PhaseAccount.id} = ${payout.phaseAccountId}
      for update
    `)
    const [trades, existingPayouts] = await Promise.all([
      tx.query.Trade.findMany({
        where: (table, { and, eq }) => and(
          eq(table.phaseAccountId, payout.phaseAccountId),
          eq(table.userId, userId),
        ),
        columns: { pnl: true, commission: true },
      }),
      tx.query.Payout.findMany({
        where: (table, { and, eq }) => and(
          eq(table.phaseAccountId, payout.phaseAccountId),
          eq(table.masterAccountId, payout.masterAccountId),
        ),
        columns: { amount: true },
      }),
    ])
    const totalProfit = trades.reduce((sum, trade) => sum + trade.pnl, 0)
    const totalPayouts = existingPayouts.reduce(
      (sum, existing) => sum + existing.amount,
      0,
    )
    const availableBalance = totalProfit - totalPayouts
    if (payout.amount > availableBalance) {
      throw new DomainError(
        `Insufficient balance for payout. Available: $${availableBalance.toFixed(2)}, Requested: $${payout.amount.toFixed(2)}`,
        'INSUFFICIENT_PAYOUT_BALANCE',
        409,
      )
    }

    const [created] = await tx.insert(schema.Payout).values({
      id: crypto.randomUUID(),
      masterAccountId: payout.masterAccountId,
      phaseAccountId: payout.phaseAccountId,
      amount: payout.amount,
      requestDate: payout.requestDate ?? new Date(),
      status: 'pending',
      notes: payout.notes ?? null,
      updatedAt: new Date(),
    }).returning()
    if (!created) throw new Error('Payout insert returned no record')

    await recordAuditEvent({
      userId,
      action: 'PAYOUT_CREATED',
      entityType: 'Payout',
      entityId: created.id,
      source: context.source,
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      afterData: {
        amount: created.amount,
        status: created.status,
        masterAccountId: created.masterAccountId,
        phaseAccountId: created.phaseAccountId,
      },
    }, tx as never)
    return created
  })

  await invalidateUserAccountCaches(userId, context.requestId)
  try {
    await NotificationService.send({
      userId,
      type: 'SYSTEM',
      title: 'Payout Requested',
      message: `Request for $${payout.amount.toFixed(2)} submitted.`,
      data: {
        payoutId: newPayout.id,
        amount: payout.amount,
        phaseAccountId: payout.phaseAccountId,
      },
    })
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'notify-payout-created',
      entityId: newPayout.id,
      ...(context.requestId ? { requestId: context.requestId } : {}),
    })
  }

  return {
    success: true,
    data: newPayout,
    message: `Payout request created for $${payout.amount.toFixed(2)}`,
  }
}

export async function deletePayoutForUser(
  userId: string,
  payoutId: string,
  context: AccountMutationContext,
) {
  if (!payoutId) throw new DomainError('Payout ID is required', 'VALIDATION_ERROR')
  const payout = await db.query.Payout.findFirst({
    where: (table, { eq }) => eq(table.id, payoutId),
    with: { MasterAccount: { columns: { userId: true } } },
  })
  if (!payout) throw new DomainError('Payout not found', 'NOT_FOUND', 404)
  if (payout.MasterAccount.userId !== userId) {
    throw new DomainError('Payout not found', 'NOT_FOUND', 404)
  }
  if (payout.status !== 'pending') {
    throw new DomainError(
      `Cannot delete ${payout.status} payout. Only pending payouts can be deleted.`,
      'PAYOUT_NOT_PENDING',
      409,
    )
  }

  await db.transaction(async (tx) => {
    const deleted = await tx.delete(schema.Payout).where(and(
      eq(schema.Payout.id, payoutId),
      eq(schema.Payout.masterAccountId, payout.masterAccountId),
    )).returning({ id: schema.Payout.id })
    if (deleted.length === 0) throw new Error('Payout was not deleted')

    await recordAuditEvent({
      userId,
      action: 'PAYOUT_DELETED',
      entityType: 'Payout',
      entityId: payoutId,
      source: context.source,
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      beforeData: {
        amount: payout.amount,
        status: payout.status,
        masterAccountId: payout.masterAccountId,
        phaseAccountId: payout.phaseAccountId,
      },
    }, tx as never)
  })

  await invalidateUserAccountCaches(userId, context.requestId)
  return { success: true, message: 'Payout deleted successfully' }
}
