import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { db } from '@/lib/db/client'
import { SiteUiSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export interface SiteUiSettingsPayload {
  showDonateButton: boolean
  showFeedbackButton: boolean
}

const SITE_UI_SETTINGS_ID = 'global'
const SITE_UI_SETTINGS_CACHE_TAG = 'site-ui-settings'

async function loadSiteUiSettings(): Promise<SiteUiSettingsPayload> {
  try {
    const [settings] = await db.select().from(SiteUiSettings).where(eq(SiteUiSettings.id, SITE_UI_SETTINGS_ID))

    return {
      showDonateButton: settings?.showDonateButton ?? true,
      showFeedbackButton: settings?.showFeedbackButton ?? true,
    }
  } catch (error) {
    Sentry.captureException(error, { extra: { route: 'server/site-ui-settings' } })
    // During build-time prerendering there's no DB connection - return defaults
    return { showDonateButton: true, showFeedbackButton: true }
  }
}

const getCachedSiteUiSettings = unstable_cache(
  loadSiteUiSettings,
  [SITE_UI_SETTINGS_CACHE_TAG],
  { tags: [SITE_UI_SETTINGS_CACHE_TAG] }
)

export async function getSiteUiSettings(): Promise<SiteUiSettingsPayload> {
  return getCachedSiteUiSettings()
}

async function updateSiteUiSettings(
  updates: Partial<SiteUiSettingsPayload>
): Promise<SiteUiSettingsPayload> {
  const [existing] = await db.select().from(SiteUiSettings).where(eq(SiteUiSettings.id, SITE_UI_SETTINGS_ID))
  
  let settings;
  if (existing) {
    const [updated] = await db.update(SiteUiSettings)
      .set({
        ...(updates.showDonateButton !== undefined && { showDonateButton: updates.showDonateButton }),
        ...(updates.showFeedbackButton !== undefined && { showFeedbackButton: updates.showFeedbackButton }),
      })
      .where(eq(SiteUiSettings.id, SITE_UI_SETTINGS_ID))
      .returning()
    settings = updated
  } else {
    const [created] = await db.insert(SiteUiSettings)
      .values({
        id: SITE_UI_SETTINGS_ID,
        showDonateButton: updates.showDonateButton ?? true,
        showFeedbackButton: updates.showFeedbackButton ?? true,
        updatedAt: new Date(),
      })
      .returning()
    settings = created
  }

  revalidateTag(SITE_UI_SETTINGS_CACHE_TAG)
  revalidatePath('/', 'layout')
  revalidatePath('/docs', 'layout')
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/feedback', 'layout')
  revalidatePath('/donate', 'layout')

  return {
    showDonateButton: settings?.showDonateButton ?? true,
    showFeedbackButton: settings?.showFeedbackButton ?? true,
  }
}

export function filterSupportNavItems<T extends { href: string }>(
  items: T[],
  settings: SiteUiSettingsPayload
) {
  return items.filter((item) => {
    if (item.href === '/donate') return settings.showDonateButton
    if (item.href === '/feedback') return settings.showFeedbackButton
    return true
  })
}
