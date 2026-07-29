import { DEMO_ORIGIN, DOCS_ORIGIN } from '@/lib/public-surface-routing'

const PRODUCTION_ORIGIN = 'https://www.justjournalit.site'
const PREVIEW_ORIGIN = 'https://justjournalit.vercel.app'

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null

  try {
    const input = value.startsWith('http') ? value : `https://${value}`
    const url = new URL(input)
    return url.origin
  } catch (error) {
    return null
  }
}

function splitOrigins(value: string | undefined | null) {
  if (!value) return []

  return value
    .split(',')
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin))
}

function getCanonicalOrigin() {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeOrigin(process.env.APP_BASE_URL) ||
    PRODUCTION_ORIGIN
  )
}

export function getAllowedOrigins() {
  const origins = new Set<string>([
    PRODUCTION_ORIGIN,
    DOCS_ORIGIN,
    DEMO_ORIGIN,
    PREVIEW_ORIGIN,
    ...splitOrigins(process.env.NEXT_PUBLIC_ALLOWED_ORIGINS),
    ...splitOrigins(process.env.ALLOWED_ORIGINS),
  ])

  if (process.env.VERCEL_ENV !== 'production') {
    origins.add(getCanonicalOrigin())
  }

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
    origins.add('http://localhost:3001')
    origins.add('http://127.0.0.1:3001')
  }

  return [...origins]
}

function isLocalOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return LOCALHOST_HOSTS.has(url.hostname)
  } catch (error) {
    return false
  }
}

export function isAllowedOrigin(origin: string | null | undefined) {
  const normalized = normalizeOrigin(origin)
  if (!normalized) return false

  if (process.env.NODE_ENV !== 'production' && isLocalOrigin(normalized)) {
    return true
  }

  return getAllowedOrigins().includes(normalized)
}

export function getCorsHeaders(origin: string | null | undefined) {
  if (!isAllowedOrigin(origin)) {
    return null
  }

  return {
    'Access-Control-Allow-Origin': normalizeOrigin(origin)!,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token',
    Vary: 'Origin',
  }
}

export function assertProductionUrl(name: string, value: string | undefined | null, options?: { required?: boolean }) {
  if (!value) {
    if (options?.required) return `${name} is required in production`
    return null
  }

  let url: URL
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch (error) {
    return `${name} must be a valid URL`
  }

  if (url.protocol !== 'https:') {
    return `${name} must use HTTPS in production`
  }

  if (LOCALHOST_HOSTS.has(url.hostname)) {
    return `${name} cannot point to localhost in production`
  }

  return null
}
