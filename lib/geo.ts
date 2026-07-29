const regionDisplayNames =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

const PLACEHOLDER_VALUES = new Set(['', 'unknown', 'xx', 'null', 'undefined', '-', '-'])

function decodeLocationPart(value?: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const decoded = decodeURIComponent(trimmed.replace(/\+/g, ' '))
    return decoded.trim() || null
  } catch (error) {
    return trimmed
  }
}

function isPlaceholder(value?: string | null) {
  return !value || PLACEHOLDER_VALUES.has(value.trim().toLowerCase())
}

export function normalizeCountryCode(value?: string | null): string | null {
  const decoded = decodeLocationPart(value)
  if (!decoded || isPlaceholder(decoded)) return null

  const normalized = decoded.toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

function normalizeCountryName(country?: string | null, countryCode?: string | null): string | null {
  const decodedCountry = decodeLocationPart(country)
  const normalizedCode = normalizeCountryCode(countryCode ?? country)

  if (normalizedCode) {
    const displayName = regionDisplayNames?.of(normalizedCode) ?? normalizedCode
    if (!decodedCountry || isPlaceholder(decodedCountry) || normalizeCountryCode(decodedCountry) === normalizedCode) {
      return displayName
    }
  }

  if (!decodedCountry || isPlaceholder(decodedCountry)) {
    return null
  }

  return decodedCountry
}

export function normalizeCityName(value?: string | null): string | null {
  const decoded = decodeLocationPart(value)
  if (!decoded || isPlaceholder(decoded)) return null
  return decoded
}

function normalizeGeoRecord<T extends { city?: string | null; country?: string | null; countryCode?: string | null }>(
  value: T | null | undefined
) {
  if (!value) return null

  const city = normalizeCityName(value.city)
  const countryCode = normalizeCountryCode(value.countryCode)
  const country = normalizeCountryName(value.country, countryCode)

  return {
    ...value,
    city,
    country,
    countryCode,
  }
}

function formatGeoLocation(value?: { city?: string | null; country?: string | null; countryCode?: string | null } | null) {
  const normalized = normalizeGeoRecord(value)
  if (!normalized) return null

  const parts = [normalized.city, normalized.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : normalized.countryCode
}

export function getCountryLabel(country?: string | null, countryCode?: string | null) {
  return normalizeCountryName(country, countryCode) ?? normalizeCountryCode(countryCode) ?? 'Unknown'
}
