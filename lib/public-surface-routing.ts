export const MAIN_APP_HOST = 'www.justjournalit.site'
export const APEX_APP_HOST = 'justjournalit.site'
export const DOCS_HOST = 'docs.justjournalit.site'
export const DEMO_HOST = 'demo.justjournalit.site'
export const PREVIEW_HOST = 'justjournalit.vercel.app'

export const MAIN_APP_ORIGIN = `https://${MAIN_APP_HOST}`
export const DOCS_ORIGIN = `https://${DOCS_HOST}`
export const DEMO_ORIGIN = `https://${DEMO_HOST}`

const PRODUCTION_SURFACE_HOSTS = new Set([
  MAIN_APP_HOST,
  APEX_APP_HOST,
  DOCS_HOST,
  DEMO_HOST,
])

export function normalizeHostname(hostname: string | null | undefined) {
  return hostname?.split(':')[0]?.replace(/\.$/, '').toLowerCase() ?? ''
}

export function isDocsHost(hostname: string | null | undefined) {
  return normalizeHostname(hostname) === DOCS_HOST
}

export function isDemoHost(hostname: string | null | undefined) {
  return normalizeHostname(hostname) === DEMO_HOST
}

export function isProductionSurfaceHost(hostname: string | null | undefined) {
  return PRODUCTION_SURFACE_HOSTS.has(normalizeHostname(hostname))
}

function splitHref(href: string) {
  const match = href.match(/^([^?#]*)([?#].*)?$/)
  return {
    pathname: match?.[1] || '/',
    suffix: match?.[2] || '',
  }
}

function stripBasePath(href: string, basePath: string) {
  const { pathname, suffix } = splitHref(href)

  if (pathname === basePath) return `/${suffix}`
  if (pathname.startsWith(`${basePath}/`)) return `${pathname.slice(basePath.length)}${suffix}`
  return `${pathname.startsWith('/') ? pathname : `/${pathname}`}${suffix}`
}

function addBasePath(cleanHref: string, basePath: string) {
  const { pathname, suffix } = splitHref(cleanHref)
  const cleanPathname = pathname === '/' ? '' : pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${basePath}${cleanPathname}${suffix}`
}

function withOrigin(origin: string, cleanHref: string) {
  return `${origin}${cleanHref.startsWith('/') ? cleanHref : `/${cleanHref}`}`
}

export function getDocsCleanHref(href = '/docs') {
  return stripBasePath(href, '/docs')
}

export function getDemoCleanHref(href = '/demo') {
  const demoHref = href.startsWith('/dashboard') ? href.replace('/dashboard', '/demo') : href
  return stripBasePath(demoHref, '/demo')
}

export function getDocsHref(href = '/docs', hostname?: string | null) {
  const cleanHref = getDocsCleanHref(href)
  if (isDocsHost(hostname)) return cleanHref
  if (isProductionSurfaceHost(hostname)) return withOrigin(DOCS_ORIGIN, cleanHref)
  return addBasePath(cleanHref, '/docs')
}

export function getDemoHref(href = '/demo', hostname?: string | null) {
  const cleanHref = getDemoCleanHref(href)
  if (isDemoHost(hostname)) return cleanHref
  if (isProductionSurfaceHost(hostname)) return withOrigin(DEMO_ORIGIN, cleanHref)
  return addBasePath(cleanHref, '/demo')
}

export function getMainAppHref(href = '/', hostname?: string | null) {
  const { pathname, suffix } = splitHref(href)
  const cleanHref = `${pathname.startsWith('/') ? pathname : `/${pathname}`}${suffix}`

  if (isProductionSurfaceHost(hostname)) {
    return withOrigin(MAIN_APP_ORIGIN, cleanHref)
  }

  return cleanHref
}

export function getDemoRouteHref(href: string, isDemoMode: boolean, hostname?: string | null) {
  if (!isDemoMode) return href
  return getDemoHref(href, hostname)
}

export function getDemoAwarePathname(pathname: string, isDemoMode: boolean, hostname?: string | null) {
  if (!isDemoMode || !isDemoHost(hostname)) return pathname
  return addBasePath(pathname, '/demo')
}

export function isDemoSurface(hostname: string | null | undefined, pathname: string | null | undefined) {
  const path = pathname || '/'
  return isDemoHost(hostname) || path === '/demo' || path.startsWith('/demo/')
}
