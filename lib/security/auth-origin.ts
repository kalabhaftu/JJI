import {
  isProductionSurfaceHost,
  MAIN_APP_ORIGIN,
  normalizeHostname,
  PREVIEW_HOST,
} from '@/lib/public-surface-routing'

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function isVercelPreviewHost(hostname: string) {
  return hostname === PREVIEW_HOST || hostname.endsWith('.vercel.app')
}

interface AuthOriginContext {
  requestOrigin?: string | null
  vercel?: string | null
  vercelEnv?: string | null
}

/**
 * Resolve the origin used for Supabase auth callbacks.
 * Production is intentionally canonical even when a deployment env var drifts.
 */
export function resolveAuthOrigin({
  requestOrigin,
  vercel = process.env.VERCEL,
  vercelEnv = process.env.VERCEL_ENV,
}: AuthOriginContext = {}) {
  const normalizedRequestOrigin = normalizeOrigin(requestOrigin)
  const requestHostname = normalizedRequestOrigin
    ? normalizeHostname(new URL(normalizedRequestOrigin).hostname)
    : ''

  if (vercelEnv === 'production' || isProductionSurfaceHost(requestHostname)) {
    return MAIN_APP_ORIGIN
  }

  if (vercel === '1' && normalizedRequestOrigin && isVercelPreviewHost(requestHostname)) {
    return normalizedRequestOrigin
  }

  return null
}
