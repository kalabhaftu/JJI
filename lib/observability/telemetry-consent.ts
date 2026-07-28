export const TELEMETRY_CONSENT_KEY = 'jji-telemetry-consent'

export function hasTelemetryConsent(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(TELEMETRY_CONSENT_KEY) === 'granted'
}

export function persistTelemetryConsent(granted: boolean): void {
  if (typeof window === 'undefined') return
  const value = granted ? 'granted' : 'denied'
  window.localStorage.setItem(TELEMETRY_CONSENT_KEY, value)
  document.cookie = `jji-telemetry-consent=${value}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
  window.dispatchEvent(new CustomEvent('jji-telemetry-consent-change', { detail: { granted } }))
}
