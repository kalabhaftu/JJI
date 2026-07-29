import { and, eq, inArray } from 'drizzle-orm'

import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { DomainError } from '@/lib/domain-error'
import { invalidateUserAccountCaches } from '@/server/accounts/cache'

export interface PropFirmLifecycleContext {
  requestId?: string
  ipAddress?: string | null
  source: 'api' | 'background-job'
}

export interface CreatePropFirmAccountCommand {
  accountName: string
  propFirmName: string
  accountSize: number
  evaluationType: 'One Step' | 'Two Step' | 'Instant'
  phase1AccountId: string
  phase1ProfitTargetPercent: number
  phase1DailyDrawdownPercent: number
  phase1MaxDrawdownPercent: number
  phase1MinTradingDays: number
  phase1TimeLimitDays: number | null
  phase1MaxDrawdownType: 'static' | 'trailing'
  phase1ConsistencyRulePercent: number
  phase2ProfitTargetPercent?: number
  phase2DailyDrawdownPercent?: number
  phase2MaxDrawdownPercent?: number
  phase2MinTradingDays?: number
  phase2TimeLimitDays?: number | null
  phase2MaxDrawdownType?: 'static' | 'trailing'
  phase2ConsistencyRulePercent?: number
  fundedDailyDrawdownPercent: number
  fundedMaxDrawdownPercent: number
  fundedMaxDrawdownType: 'static' | 'trailing'
  fundedProfitSplitPercent: number
  fundedPayoutCycleDays: number
  fundedMinProfitForPayout: number
}

export async function createPropFirmAccountForUser(
  userId: string,
  command: CreatePropFirmAccountCommand,
  context: PropFirmLifecycleContext,
) {
  const result = await db.transaction(async (tx) => {
    const [masterAccount] = await tx.insert(schema.MasterAccount).values({
      id: crypto.randomUUID(),
      userId,
      accountName: command.accountName,
      propFirmName: command.propFirmName,
      accountSize: command.accountSize,
      evaluationType: command.evaluationType,
      currentPhase: 1,
      status: 'active',
    }).returning()
    if (!masterAccount) throw new Error('Master account insert returned no record')

    const [phase1] = await tx.insert(schema.PhaseAccount).values({
      id: crypto.randomUUID(),
      masterAccountId: masterAccount.id,
      phaseNumber: 1,
      phaseId: command.phase1AccountId,
      status: 'active',
      profitTargetPercent: command.evaluationType === 'Instant'
        ? 0
        : command.phase1ProfitTargetPercent,
      dailyDrawdownPercent: command.phase1DailyDrawdownPercent,
      maxDrawdownPercent: command.phase1MaxDrawdownPercent,
      maxDrawdownType: command.phase1MaxDrawdownType,
      minTradingDays: command.phase1MinTradingDays,
      timeLimitDays: command.phase1TimeLimitDays ?? undefined,
      consistencyRulePercent: command.phase1ConsistencyRulePercent,
    }).returning()

    let phase2: typeof phase1 | null = null
    if (command.evaluationType === 'Two Step') {
      const [createdPhase2] = await tx.insert(schema.PhaseAccount).values({
        id: crypto.randomUUID(),
        masterAccountId: masterAccount.id,
        phaseNumber: 2,
        phaseId: null,
        status: 'pending',
        profitTargetPercent: command.phase2ProfitTargetPercent!,
        dailyDrawdownPercent: command.phase2DailyDrawdownPercent!,
        maxDrawdownPercent: command.phase2MaxDrawdownPercent!,
        maxDrawdownType: command.phase2MaxDrawdownType ?? 'static',
        minTradingDays: command.phase2MinTradingDays ?? 0,
        timeLimitDays: command.phase2TimeLimitDays ?? undefined,
        consistencyRulePercent: command.phase2ConsistencyRulePercent ?? 0,
      }).returning()
      if (!createdPhase2) {
        throw new Error('Second phase account insert returned no record')
      }
      phase2 = createdPhase2
    }

    const fundedPhaseNumber = command.evaluationType === 'One Step'
      ? 2
      : command.evaluationType === 'Instant'
        ? 1
        : 3
    const [fundedPhase] = await tx.insert(schema.PhaseAccount).values({
      id: crypto.randomUUID(),
      masterAccountId: masterAccount.id,
      phaseNumber: fundedPhaseNumber,
      phaseId: null,
      status: command.evaluationType === 'Instant' ? 'active' : 'pending',
      profitTargetPercent: 0,
      dailyDrawdownPercent: command.fundedDailyDrawdownPercent,
      maxDrawdownPercent: command.fundedMaxDrawdownPercent,
      maxDrawdownType: command.fundedMaxDrawdownType,
      minTradingDays: 0,
      timeLimitDays: undefined,
      consistencyRulePercent: 0,
      profitSplitPercent: command.fundedProfitSplitPercent,
      payoutCycleDays: command.fundedPayoutCycleDays,
      minProfitForPayout: command.fundedMinProfitForPayout,
    }).returning()
    if (!phase1 || !fundedPhase) {
      throw new Error('Phase account insert returned no record')
    }

    if (command.evaluationType === 'Instant') {
      await tx.update(schema.PhaseAccount)
        .set({ phaseId: command.phase1AccountId })
        .where(eq(schema.PhaseAccount.id, fundedPhase.id))
    }

    await recordAuditEvent({
      userId,
      action: 'PROP_FIRM_ACCOUNT_CREATED',
      entityType: 'MasterAccount',
      entityId: masterAccount.id,
      source: context.source,
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      afterData: {
        accountName: masterAccount.accountName,
        propFirmName: masterAccount.propFirmName,
        accountSize: masterAccount.accountSize,
        evaluationType: masterAccount.evaluationType,
        currentPhase: fundedPhaseNumber === 1 ? 1 : masterAccount.currentPhase,
      },
    }, tx as never)

    return {
      masterAccount,
      phases: [phase1, phase2, fundedPhase].filter(Boolean),
    }
  })

  await invalidateUserAccountCaches(userId, context.requestId)
  return result
}

export async function updatePropFirmAccountForUser(
  userId: string,
  masterAccountId: string,
  command: {
    accountName?: string
    status?: 'active' | 'funded' | 'failed'
    isArchived?: boolean
  },
  context: PropFirmLifecycleContext,
) {
  const existing = await db.query.MasterAccount.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.id, masterAccountId),
      operators.eq(table.userId, userId),
    ),
  })
  if (!existing) {
    throw new DomainError('Master account not found or unauthorized', 'NOT_FOUND', 404)
  }

  const updated = await db.transaction(async (tx) => {
    const [account] = await tx.update(schema.MasterAccount)
      .set({ ...command, updatedAt: new Date() })
      .where(and(
        eq(schema.MasterAccount.id, masterAccountId),
        eq(schema.MasterAccount.userId, userId),
      ))
      .returning()
    if (!account) throw new DomainError('Master account not found', 'NOT_FOUND', 404)

    await recordAuditEvent({
      userId,
      action: 'PROP_FIRM_ACCOUNT_UPDATED',
      entityType: 'MasterAccount',
      entityId: masterAccountId,
      source: context.source,
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      beforeData: {
        accountName: existing.accountName,
        status: existing.status,
        isArchived: existing.isArchived,
      },
      afterData: {
        accountName: account.accountName,
        status: account.status,
        isArchived: account.isArchived,
        updatedFields: Object.keys(command),
      },
    }, tx as never)
    return account
  })

  await invalidateUserAccountCaches(userId, context.requestId)
  return updated
}

export async function deletePropFirmAccountForUser(
  userId: string,
  masterAccountId: string,
  context: PropFirmLifecycleContext,
) {
  const existing = await db.query.MasterAccount.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.id, masterAccountId),
      operators.eq(table.userId, userId),
    ),
    with: {
      PhaseAccount: {
        columns: { id: true, phaseId: true },
      },
    },
  })
  if (!existing) {
    throw new DomainError('Master account not found or unauthorized', 'NOT_FOUND', 404)
  }

  await db.transaction(async (tx) => {
    const phaseIds = existing.PhaseAccount.map((phase) => phase.id)
    if (phaseIds.length > 0) {
      const tradeRows = await tx.select({ id: schema.Trade.id })
        .from(schema.Trade)
        .where(inArray(schema.Trade.phaseAccountId, phaseIds))
      const tradeIds = tradeRows.map((trade) => trade.id)
      if (tradeIds.length > 0) {
        await tx.delete(schema.TradeExecution)
          .where(inArray(schema.TradeExecution.tradeId, tradeIds))
        await tx.delete(schema.Trade).where(inArray(schema.Trade.id, tradeIds))
      }
      await tx.delete(schema.DailyAnchor)
        .where(inArray(schema.DailyAnchor.phaseAccountId, phaseIds))
      await tx.delete(schema.BreachRecord)
        .where(inArray(schema.BreachRecord.phaseAccountId, phaseIds))
      await tx.delete(schema.Payout)
        .where(inArray(schema.Payout.phaseAccountId, phaseIds))
      await tx.delete(schema.PhaseAccount)
        .where(eq(schema.PhaseAccount.masterAccountId, masterAccountId))
    }

    const deleted = await tx.delete(schema.MasterAccount).where(and(
      eq(schema.MasterAccount.id, masterAccountId),
      eq(schema.MasterAccount.userId, userId),
    )).returning({ id: schema.MasterAccount.id })
    if (deleted.length === 0) {
      throw new DomainError('Master account not found', 'NOT_FOUND', 404)
    }

    await recordAuditEvent({
      userId,
      action: 'PROP_FIRM_ACCOUNT_DELETED',
      entityType: 'MasterAccount',
      entityId: masterAccountId,
      source: context.source,
      requestId: context.requestId ?? null,
      ipAddress: context.ipAddress ?? null,
      beforeData: {
        accountName: existing.accountName,
        propFirmName: existing.propFirmName,
        accountSize: existing.accountSize,
        evaluationType: existing.evaluationType,
        phaseCount: existing.PhaseAccount.length,
      },
    }, tx as never)
  })

  await invalidateUserAccountCaches(userId, context.requestId)
}
