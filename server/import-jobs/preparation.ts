import {
  prepareAccounts,
  prepareMasterAccounts,
} from '@/server/import-jobs/handlers/accounts'
import {
  prepareJournalTemplates,
  prepareNotifications,
  prepareUserGoals,
  prepareWeeklyAIReviews,
} from '@/server/import-jobs/handlers/journal'
import {
  prepareBreachRecords,
  prepareDailyAnchors,
  prepareLiveAccountTransactions,
  preparePayouts,
} from '@/server/import-jobs/handlers/prop-firm'
import {
  prepareDashboardTemplates,
  prepareTradeTags,
  prepareTradingModels,
  prepareUser,
} from '@/server/import-jobs/handlers/preferences'
import type {
  ImportPreparationContext,
  ImportPreparationHandler,
} from '@/server/import-jobs/preparation-types'

export const IMPORT_PREPARATION_REGISTRY: readonly ImportPreparationHandler[] = [
  prepareUser,
  prepareTradeTags,
  prepareTradingModels,
  prepareDashboardTemplates,
  prepareAccounts,
  prepareMasterAccounts,
  prepareJournalTemplates,
  prepareWeeklyAIReviews,
  prepareUserGoals,
  prepareNotifications,
  prepareLiveAccountTransactions,
  prepareBreachRecords,
  prepareDailyAnchors,
  preparePayouts,
]

export async function runImportPreparation(
  data: any,
  internalUserId: string,
) {
  const context: ImportPreparationContext = {
    accountMap: new Map(),
    phaseMap: new Map(),
    phaseNumberMap: new Map(),
    masterMap: new Map(),
  }

  for (const prepareEntity of IMPORT_PREPARATION_REGISTRY) {
    await prepareEntity(data, internalUserId, context)
  }
}
