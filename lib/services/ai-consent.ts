import { db } from '@/lib/db/client'
import { AI_DATA_CONSENT_VERSION, normalizeAiSettings } from '@/lib/user-settings'

export async function hasCurrentAiDataConsent(userId: string) {
  const settings = await db.query.UserSettings.findFirst({
    where: (table, { eq }) => eq(table.userId, userId),
    columns: { aiSettings: true },
  })
  const aiSettings = normalizeAiSettings(settings?.aiSettings)
  return Boolean(
    aiSettings.dataProcessingConsentAt &&
      aiSettings.dataProcessingConsentVersion === AI_DATA_CONSENT_VERSION
  )
}
