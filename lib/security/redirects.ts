export function getSafeRedirectPath(next: string | null | undefined, fallback = '/dashboard') {
  if (!next) return fallback

  let decoded: string
  try {
    decoded = decodeURIComponent(next)
  } catch (error) {
    return fallback
  }

  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('://') ||
    decoded.includes('\\') ||
    /%5c/i.test(next)
  ) {
    return fallback
  }

  return decoded
}
