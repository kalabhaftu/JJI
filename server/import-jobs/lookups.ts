import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/lib/db/client'

export async function resolveImportLookupMaps(
  data: Record<string, any>,
  internalUserId: string,
) {
  const accountNumbers = [
    ...new Set<string>(
      (data.accounts ?? []).map((account: any) => account.number).filter(Boolean),
    ),
  ]
  const modelNames = [
    ...new Set<string>(
      (data.tradingModels ?? []).map((model: any) => model.name).filter(Boolean),
    ),
  ]
  const phaseIds = [
    ...new Set<string>(
      (data.masterAccounts ?? [])
        .flatMap((master: any) => master?.PhaseAccount ?? [])
        .map((phase: any) => phase?.phaseId)
        .filter((phaseId: unknown): phaseId is string => (
          typeof phaseId === 'string' && phaseId.trim().length > 0
        )),
    ),
  ]

  const [accounts, models, phases] = await Promise.all([
    accountNumbers.length > 0
      ? db.query.Account.findMany({
          where: (table, { inArray }) => and(
            eq(table.userId, internalUserId),
            inArray(table.number, accountNumbers),
          ),
          columns: { id: true, number: true },
        })
      : [],
    modelNames.length > 0
      ? db.query.TradingModel.findMany({
          where: (table, { inArray }) => and(
            eq(table.userId, internalUserId),
            inArray(table.name, modelNames),
          ),
          columns: { id: true, name: true },
        })
      : [],
    phaseIds.length > 0
      ? db.query.PhaseAccount.findMany({
          where: (table, { inArray }) => inArray(table.phaseId, phaseIds),
          columns: { id: true, phaseId: true },
          with: { MasterAccount: { columns: { userId: true } } },
        })
      : [],
  ])

  return {
    accountMap: new Map(accounts.map((account) => [account.number, account.id])),
    modelNameMap: new Map(models.map((model) => [model.name, model.id])),
    phaseMap: new Map(
      phases
        .filter((phase) => (
          phase.phaseId
          && phase.MasterAccount.userId === internalUserId
        ))
        .map((phase) => [phase.phaseId as string, phase.id]),
    ),
  }
}
