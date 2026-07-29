import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import type { ImportPreparationHandler } from '@/server/import-jobs/preparation-types'

export const prepareLiveAccountTransactions: ImportPreparationHandler = async (
  data,
  internalUserId,
  { accountMap },
) => {
  for (const transaction of data.liveAccountTransactions ?? []) {
    const targetAccountId = accountMap.get(transaction.accountNumber)
    if (!targetAccountId || !transaction.createdAt) continue
    const createdAt = new Date(transaction.createdAt)
    const existing = await db.query.LiveAccountTransaction.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.accountId, targetAccountId),
        operators.eq(table.amount, transaction.amount),
        operators.eq(table.createdAt, createdAt),
      ),
    })
    if (existing) continue

    await db.insert(schema.LiveAccountTransaction).values({
      id: crypto.randomUUID(),
      accountId: targetAccountId,
      userId: internalUserId,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      createdAt,
    })
  }
}

export const prepareBreachRecords: ImportPreparationHandler = async (
  data,
  _internalUserId,
  { phaseMap, phaseNumberMap },
) => {
  for (const breach of data.breachRecords ?? []) {
    const targetPhaseId = phaseMap.get(breach.phaseId)
      ?? (
        breach.accountName && breach.phaseNumber != null
          ? phaseNumberMap.get(`${breach.accountName}:${breach.phaseNumber}`)
          : undefined
      )
    if (!targetPhaseId || !breach.breachTime) continue
    const breachTime = new Date(breach.breachTime)
    const existing = await db.query.BreachRecord.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.phaseAccountId, targetPhaseId),
        operators.eq(table.breachType, breach.breachType),
        operators.eq(table.breachTime, breachTime),
      ),
    })
    if (existing) continue

    await db.insert(schema.BreachRecord).values({
      id: crypto.randomUUID(),
      phaseAccountId: targetPhaseId,
      breachType: breach.breachType,
      breachAmount: breach.breachAmount,
      breachTime,
      currentEquity: breach.currentEquity,
      accountSize: breach.accountSize,
      dailyStartBalance: breach.dailyStartBalance,
      highWaterMark: breach.highWaterMark,
      notes: breach.notes,
      updatedAt: new Date(),
    }).onConflictDoNothing({
      target: [
        schema.BreachRecord.phaseAccountId,
        schema.BreachRecord.breachType,
      ],
    })
  }
}

export const prepareDailyAnchors: ImportPreparationHandler = async (
  data,
  _internalUserId,
  { phaseMap, phaseNumberMap },
) => {
  for (const anchor of data.dailyAnchors ?? []) {
    const targetPhaseId = phaseMap.get(anchor.phaseId)
      ?? (
        anchor.accountName && anchor.phaseNumber != null
          ? phaseNumberMap.get(`${anchor.accountName}:${anchor.phaseNumber}`)
          : undefined
      )
    if (!targetPhaseId || !anchor.date) continue
    const date = new Date(anchor.date)
    const existing = await db.query.DailyAnchor.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.phaseAccountId, targetPhaseId),
        operators.eq(table.date, date),
      ),
    })
    if (existing) {
      await db.update(schema.DailyAnchor)
        .set({ anchorEquity: anchor.anchorEquity })
        .where(and(
          eq(schema.DailyAnchor.phaseAccountId, targetPhaseId),
          eq(schema.DailyAnchor.date, date),
        ))
    } else {
      await db.insert(schema.DailyAnchor).values({
        id: crypto.randomUUID(),
        phaseAccountId: targetPhaseId,
        date,
        anchorEquity: anchor.anchorEquity,
      })
    }
  }
}

export const preparePayouts: ImportPreparationHandler = async (
  data,
  _internalUserId,
  { masterMap, phaseMap, phaseNumberMap },
) => {
  for (const payout of data.payouts ?? []) {
    const targetMasterId = masterMap.get(payout.accountName)
    const targetPhaseId = payout.phaseId
      ? phaseMap.get(payout.phaseId)
        ?? (
          payout.accountName && payout.phaseNumber != null
            ? phaseNumberMap.get(`${payout.accountName}:${payout.phaseNumber}`)
            : undefined
        )
      : payout.accountName && payout.phaseNumber != null
        ? phaseNumberMap.get(`${payout.accountName}:${payout.phaseNumber}`)
        : undefined
    if (!targetMasterId || !targetPhaseId || !payout.requestDate) continue

    const requestDate = new Date(payout.requestDate)
    const existing = await db.query.Payout.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.masterAccountId, targetMasterId),
        operators.eq(table.phaseAccountId, targetPhaseId),
        operators.eq(table.amount, payout.amount),
        operators.eq(table.requestDate, requestDate),
      ),
    })
    if (existing) continue

    await db.insert(schema.Payout).values({
      id: crypto.randomUUID(),
      masterAccountId: targetMasterId,
      phaseAccountId: targetPhaseId,
      amount: payout.amount,
      status: payout.status,
      requestDate,
      approvedDate: payout.approvedDate ? new Date(payout.approvedDate) : null,
      paidDate: payout.paidDate ? new Date(payout.paidDate) : null,
      rejectedDate: payout.rejectedDate ? new Date(payout.rejectedDate) : null,
      notes: payout.notes,
      rejectionReason: payout.rejectionReason,
      updatedAt: new Date(),
    })
  }
}
