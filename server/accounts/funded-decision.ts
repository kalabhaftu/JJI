import { and, desc, eq } from 'drizzle-orm'

import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'

interface FundedDecisionContext {
  requestId?: string
  ipAddress?: string | null
}

export async function approveFundedAccountForUser(input: {
  userId: string
  notificationId: string
  masterAccountId: string
  fundedAccountId: string
  context: FundedDecisionContext
}) {
  const master = await db.query.MasterAccount.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.id, input.masterAccountId),
      operators.eq(table.userId, input.userId),
    ),
    with: {
      PhaseAccount: {
        orderBy: (table) => [desc(table.phaseNumber)],
      },
    },
  })
  if (!master) throw new Error('Account not found')
  const pending = master.PhaseAccount.find((phase) => phase.status === 'pending_approval')
  if (!pending) throw new Error('No pending approval found for this account')

  await db.transaction(async (tx) => {
    const isInstant = master.evaluationType === 'Instant'
    if (isInstant) {
      await tx.update(schema.PhaseAccount)
        .set({ phaseId: input.fundedAccountId, status: 'active' })
        .where(eq(schema.PhaseAccount.id, pending.id))
    } else {
      await tx.update(schema.PhaseAccount)
        .set({ status: 'passed' })
        .where(eq(schema.PhaseAccount.id, pending.id))
      const fundedPhaseNumber = pending.phaseNumber + 1
      const funded = master.PhaseAccount.find((phase) => phase.phaseNumber === fundedPhaseNumber)
      if (!funded) throw new Error(`Funded phase ${fundedPhaseNumber} not found`)
      await tx.update(schema.PhaseAccount)
        .set({ phaseId: input.fundedAccountId, status: 'active' })
        .where(eq(schema.PhaseAccount.id, funded.id))
    }

    await tx.update(schema.MasterAccount)
      .set({
        currentPhase: isInstant ? 1 : pending.phaseNumber + 1,
        status: 'funded',
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.MasterAccount.id, input.masterAccountId),
        eq(schema.MasterAccount.userId, input.userId),
      ))
    await tx.update(schema.Notification)
      .set({ isRead: true, actionRequired: false, updatedAt: new Date() })
      .where(and(
        eq(schema.Notification.id, input.notificationId),
        eq(schema.Notification.userId, input.userId),
      ))
    await tx.insert(schema.Notification).values({
      userId: input.userId,
      type: 'FUNDED_APPROVED',
      title: 'Funded Account Activated',
      message: `Congratulations! Your ${master.accountName} account is now funded.`,
      data: {
        masterAccountId: input.masterAccountId,
        fundedAccountId: input.fundedAccountId,
      },
      actionRequired: false,
      updatedAt: new Date(),
    })
    await recordAuditEvent({
      userId: input.userId,
      action: 'FUNDED_ACCOUNT_APPROVED',
      entityType: 'MasterAccount',
      entityId: input.masterAccountId,
      source: 'api',
      requestId: input.context.requestId,
      ipAddress: input.context.ipAddress,
      afterData: { status: 'funded' },
    }, tx as never)
  })
}

export async function declineFundedAccountForUser(input: {
  userId: string
  notificationId: string
  masterAccountId: string
  reason: string
  context: FundedDecisionContext
}) {
  const master = await db.query.MasterAccount.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.id, input.masterAccountId),
      operators.eq(table.userId, input.userId),
    ),
    with: { PhaseAccount: true },
  })
  if (!master) throw new Error('Account not found')
  const pending = master.PhaseAccount.find((phase) => phase.status === 'pending_approval')
  if (!pending) throw new Error('No pending approval found for this account')

  await db.transaction(async (tx) => {
    await tx.update(schema.PhaseAccount)
      .set({ status: 'failed' })
      .where(eq(schema.PhaseAccount.id, pending.id))
    await tx.update(schema.MasterAccount)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(and(
        eq(schema.MasterAccount.id, input.masterAccountId),
        eq(schema.MasterAccount.userId, input.userId),
      ))
    await tx.update(schema.Notification)
      .set({ isRead: true, actionRequired: false, updatedAt: new Date() })
      .where(and(
        eq(schema.Notification.id, input.notificationId),
        eq(schema.Notification.userId, input.userId),
      ))
    await tx.insert(schema.Notification).values({
      userId: input.userId,
      type: 'FUNDED_DECLINED',
      title: 'Funded Request Declined',
      message: `Your ${master.accountName} account was declined by the firm.`,
      data: {
        masterAccountId: input.masterAccountId,
        reason: input.reason,
        note: 'Met profit target but failed firm review',
      },
      actionRequired: false,
      updatedAt: new Date(),
    })
    await recordAuditEvent({
      userId: input.userId,
      action: 'FUNDED_ACCOUNT_DECLINED',
      entityType: 'MasterAccount',
      entityId: input.masterAccountId,
      source: 'api',
      requestId: input.context.requestId,
      ipAddress: input.context.ipAddress,
      afterData: { status: 'failed', reason: input.reason },
    }, tx as never)
  })
}
