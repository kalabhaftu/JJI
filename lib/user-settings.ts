
import type { UserType, UserSettingsType, NewUserSettings } from '@/lib/db/schema/users';


export const DEFAULT_AI_SETTINGS = {
  autoGenerateInsights: false,
  includeAiInsightsInNotifications: false,
  dataProcessingConsentAt: null as string | null,
  dataProcessingConsentVersion: null as string | null,
}

export const AI_DATA_CONSENT_VERSION = '2026-07-22'

export const USER_SETTINGS_SELECT = {
  timezone: true,
  theme: true,
  accountFilterSettings: true,
  aiSettings: true,
  backtestInputMode: true,
  breakEvenThreshold: true,
  pnlDisplayMode: true,
  accentPack: true,
  widgetStyle: true,
  chartStyle: true,
  autoAdjustAccountDate: true,
} as const

export type UserSettingsShape = Pick<UserSettingsType, typeof USER_SETTINGS_FIELDS[number]>

const USER_SETTINGS_FIELDS = [
  'timezone',
  'theme',
  'accountFilterSettings',
  'aiSettings',
  'backtestInputMode',
  'breakEvenThreshold',
  'pnlDisplayMode',
  'accentPack',
  'widgetStyle',
  'chartStyle',
  'autoAdjustAccountDate',
] as const

type SettingsField = (typeof USER_SETTINGS_FIELDS)[number]

export function normalizeAiSettings(value: unknown) {
  const raw = typeof value === 'object' && value ? (value as Record<string, unknown>) : {}
  return {
    autoGenerateInsights: !!raw.autoGenerateInsights,
    includeAiInsightsInNotifications: raw.includeAiInsightsInNotifications !== false
      ? !!raw.includeAiInsightsInNotifications
      : false,
    dataProcessingConsentAt: typeof raw.dataProcessingConsentAt === 'string' && !Number.isNaN(Date.parse(raw.dataProcessingConsentAt))
      ? raw.dataProcessingConsentAt
      : null,
    dataProcessingConsentVersion: typeof raw.dataProcessingConsentVersion === 'string'
      ? raw.dataProcessingConsentVersion
      : null,
  }
}

export function getDefaultUserSettings(): UserSettingsShape {
  return {
    timezone: 'America/New_York',
    theme: 'system',
    accountFilterSettings: null,
    aiSettings: DEFAULT_AI_SETTINGS,
    backtestInputMode: 'manual',
    breakEvenThreshold: 10,
    pnlDisplayMode: 'net',
    accentPack: 'classic',
    widgetStyle: 'default',
    chartStyle: 'smooth',
    autoAdjustAccountDate: false,
  }
}

export function mergeUserSettings<T extends Record<string, unknown>>(
  user: T,
  settings?: Partial<UserSettingsShape> | null
) {
  const defaults = getDefaultUserSettings()
  const resolved = {
    timezone: settings?.timezone ?? defaults.timezone,
    theme: settings?.theme ?? defaults.theme,
    accountFilterSettings: settings?.accountFilterSettings ?? defaults.accountFilterSettings,
    aiSettings: normalizeAiSettings(settings?.aiSettings ?? defaults.aiSettings),
    backtestInputMode: settings?.backtestInputMode ?? defaults.backtestInputMode,
    breakEvenThreshold: settings?.breakEvenThreshold ?? defaults.breakEvenThreshold,
    pnlDisplayMode: settings?.pnlDisplayMode ?? defaults.pnlDisplayMode,
    accentPack: settings?.accentPack ?? defaults.accentPack,
    widgetStyle: settings?.widgetStyle ?? defaults.widgetStyle,
    chartStyle: settings?.chartStyle ?? defaults.chartStyle,
    autoAdjustAccountDate: settings?.autoAdjustAccountDate ?? defaults.autoAdjustAccountDate,
  }

  return {
    ...user,
    ...resolved,
  }
}

function extractUserSettingsData(
  source: Partial<UserSettingsShape> | null | undefined
): UserSettingsShape {
  const defaults = getDefaultUserSettings()
  return {
    timezone: source?.timezone ?? defaults.timezone,
    theme: source?.theme ?? defaults.theme,
    accountFilterSettings: source?.accountFilterSettings ?? defaults.accountFilterSettings,
    aiSettings: normalizeAiSettings(source?.aiSettings ?? defaults.aiSettings),
    backtestInputMode: source?.backtestInputMode ?? defaults.backtestInputMode,
    breakEvenThreshold: source?.breakEvenThreshold ?? defaults.breakEvenThreshold,
    pnlDisplayMode: source?.pnlDisplayMode ?? defaults.pnlDisplayMode,
    accentPack: source?.accentPack ?? defaults.accentPack,
    widgetStyle: source?.widgetStyle ?? defaults.widgetStyle,
    chartStyle: source?.chartStyle ?? defaults.chartStyle,
    autoAdjustAccountDate: source?.autoAdjustAccountDate ?? defaults.autoAdjustAccountDate,
  }
}

function toNullableJsonInput(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null
  }

  return normalizeAiSettings(value)
}

export function extractUserSettingsWriteData(
  source: Partial<UserSettingsShape> | null | undefined
) {
  const normalized = extractUserSettingsData(source)

  return {
    timezone: normalized.timezone,
    theme: normalized.theme,
    accountFilterSettings: normalized.accountFilterSettings,
    aiSettings: toNullableJsonInput(normalized.aiSettings),
    backtestInputMode: normalized.backtestInputMode,
    breakEvenThreshold: normalized.breakEvenThreshold,
    pnlDisplayMode: normalized.pnlDisplayMode,
    accentPack: normalized.accentPack,
    widgetStyle: normalized.widgetStyle,
    chartStyle: normalized.chartStyle,
    autoAdjustAccountDate: normalized.autoAdjustAccountDate,
    updatedAt: new Date()
  }
}

export function buildUserSettingsUpdateData(
  source: Partial<UserSettingsShape>
): Partial<NewUserSettings> {
  const update: Partial<NewUserSettings> = {}

  if ('timezone' in source && source.timezone !== undefined) update.timezone = source.timezone
  if ('theme' in source && source.theme !== undefined) update.theme = source.theme
  if ('accountFilterSettings' in source && source.accountFilterSettings !== undefined) {
    update.accountFilterSettings = source.accountFilterSettings
  }
  if ('aiSettings' in source && source.aiSettings !== undefined) {
    update.aiSettings = toNullableJsonInput(source.aiSettings)
  }
  if ('backtestInputMode' in source && source.backtestInputMode !== undefined) {
    update.backtestInputMode = source.backtestInputMode
  }
  if ('breakEvenThreshold' in source && source.breakEvenThreshold !== undefined) {
    update.breakEvenThreshold = source.breakEvenThreshold
  }
  if ('pnlDisplayMode' in source && source.pnlDisplayMode !== undefined) {
    update.pnlDisplayMode = source.pnlDisplayMode
  }
  if ('accentPack' in source && source.accentPack !== undefined) {
    update.accentPack = source.accentPack
  }
  if ('widgetStyle' in source && source.widgetStyle !== undefined) {
    update.widgetStyle = source.widgetStyle
  }
  if ('chartStyle' in source && source.chartStyle !== undefined) {
    update.chartStyle = source.chartStyle
  }
  if ('autoAdjustAccountDate' in source && source.autoAdjustAccountDate !== undefined) {
    update.autoAdjustAccountDate = source.autoAdjustAccountDate
  }

  update.updatedAt = new Date()

  return update
}

export function pickSettingsPatch(source: Record<string, unknown>) {
  const patch: Partial<UserSettingsShape> = {}

  for (const field of USER_SETTINGS_FIELDS) {
    if (field in source && source[field] !== undefined) {
      ;(patch as any)[field] = source[field]
    }
  }

  if ('aiSettings' in patch) {
    patch.aiSettings = normalizeAiSettings(patch.aiSettings)
  }

  return patch
}

function settingsCreateFromUser(user: { id: string } & Partial<UserSettingsShape>): NewUserSettings {
  return {
    ...extractUserSettingsWriteData(user),
    userId: user.id,
    updatedAt: new Date(),
  }
}
