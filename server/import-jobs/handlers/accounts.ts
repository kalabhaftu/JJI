import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import type { ImportPreparationHandler } from '@/server/import-jobs/preparation-types'

export const prepareAccounts: ImportPreparationHandler = async (
  data,
  internalUserId,
  { accountMap },
) => {
  for (const account of data.accounts ?? []) {
    if (!account?.number) continue
    const existing = await db.query.Account.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.number, account.number),
        operators.eq(table.userId, internalUserId),
      ),
    })
    const [target] = existing
      ? await db.update(schema.Account)
        .set({
          name: account.name,
          broker: account.broker,
          startingBalance: account.startingBalance,
          isArchived: account.isArchived,
        })
        .where(and(
          eq(schema.Account.number, account.number),
          eq(schema.Account.userId, internalUserId),
        ))
        .returning()
      : await db.insert(schema.Account)
        .values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          number: account.number,
          name: account.name,
          broker: account.broker,
          startingBalance: account.startingBalance || 0,
          isArchived: account.isArchived || false,
          updatedAt: new Date(),
        })
        .returning()

    if (target) accountMap.set(account.number, target.id)
  }
}

export const prepareMasterAccounts: ImportPreparationHandler = async (
  data,
  internalUserId,
  { masterMap, phaseMap, phaseNumberMap },
) => {
  for (const masterAccount of data.masterAccounts ?? []) {
    if (!masterAccount?.accountName) continue
    const existing = await db.query.MasterAccount.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.userId, internalUserId),
        operators.eq(table.accountName, masterAccount.accountName),
      ),
    })
    const [targetMaster] = existing
      ? await db.update(schema.MasterAccount)
        .set({
          propFirmName: masterAccount.propFirmName,
          accountSize: masterAccount.accountSize,
          evaluationType: masterAccount.evaluationType,
          currentPhase: masterAccount.currentPhase,
          status: masterAccount.status,
          isArchived: masterAccount.isArchived,
        })
        .where(and(
          eq(schema.MasterAccount.userId, internalUserId),
          eq(schema.MasterAccount.accountName, masterAccount.accountName),
        ))
        .returning()
      : await db.insert(schema.MasterAccount)
        .values({
          id: crypto.randomUUID(),
          userId: internalUserId,
          accountName: masterAccount.accountName,
          propFirmName: masterAccount.propFirmName,
          accountSize: masterAccount.accountSize,
          evaluationType: masterAccount.evaluationType,
          currentPhase: masterAccount.currentPhase,
          status: masterAccount.status,
          isArchived: masterAccount.isArchived,
        })
        .returning()

    if (!targetMaster) continue
    masterMap.set(masterAccount.accountName, targetMaster.id)

    for (const phase of masterAccount.PhaseAccount ?? []) {
      const existingPhase = await db.query.PhaseAccount.findFirst({
        where: (table, operators) => operators.and(
          operators.eq(table.masterAccountId, targetMaster.id),
          operators.eq(table.phaseNumber, phase.phaseNumber),
        ),
      })
      const [targetPhase] = existingPhase
        ? await db.update(schema.PhaseAccount)
          .set({
            phaseId: phase.phaseId,
            status: phase.status,
            profitTargetPercent: phase.profitTargetPercent,
            dailyDrawdownPercent: phase.dailyDrawdownPercent,
            maxDrawdownPercent: phase.maxDrawdownPercent,
            startDate: phase.startDate ? new Date(phase.startDate) : undefined,
          })
          .where(and(
            eq(schema.PhaseAccount.masterAccountId, targetMaster.id),
            eq(schema.PhaseAccount.phaseNumber, phase.phaseNumber),
          ))
          .returning()
        : await db.insert(schema.PhaseAccount)
          .values({
            id: crypto.randomUUID(),
            masterAccountId: targetMaster.id,
            phaseNumber: phase.phaseNumber,
            phaseId: phase.phaseId,
            profitTargetPercent: phase.profitTargetPercent,
            dailyDrawdownPercent: phase.dailyDrawdownPercent,
            maxDrawdownPercent: phase.maxDrawdownPercent,
            status: phase.status,
            startDate: phase.startDate ? new Date(phase.startDate) : undefined,
          })
          .returning()

      if (!targetPhase) continue
      if (phase.phaseId) phaseMap.set(phase.phaseId, targetPhase.id)
      phaseNumberMap.set(
        `${masterAccount.accountName}:${phase.phaseNumber}`,
        targetPhase.id,
      )
    }
  }
}
