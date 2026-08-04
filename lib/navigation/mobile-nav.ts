import { getDemoAwarePathname, getDemoRouteHref } from '@/lib/public-surface-routing'
import {
  getActiveNavigationId,
  getMoreNavigation,
  getPrimaryMobileNavigation,
  resolveNavigationPath,
  type NavigationContext,
} from '@/lib/navigation/registry'

export type MobileNavId =
  | 'widgets'
  | 'journal'
  | 'reports'
  | 'table'
  | 'more'

export const MOBILE_SYNC_EVENT = 'jji:manual-sync'

export const MOBILE_NAV_DESTINATIONS: ReadonlyArray<{
  id: MobileNavId
  label: string
  href: string
}> = [
  { id: 'widgets', label: 'Overview', href: '/dashboard' },
  { id: 'journal', label: 'Journal', href: '/dashboard/journal' },
  { id: 'table', label: 'Trades', href: '/dashboard/table' },
  { id: 'reports', label: 'Reports', href: '/dashboard/reports' },
  { id: 'more', label: 'More', href: '#more' },
]

export function getMobileNavHref(href: string, isDemoMode: boolean, hostname?: string | null): string {
  if (href.startsWith('#')) return href
  const entry = [...getPrimaryMobileNavigation({ surface: isDemoMode ? 'demo' : 'authenticated', isDemo: isDemoMode, hostname }), ...getMoreNavigation({ surface: isDemoMode ? 'demo' : 'authenticated', isDemo: isDemoMode, hostname })].find((candidate) => candidate.path === href)
  return entry ? resolveNavigationPath(entry, { surface: isDemoMode ? 'demo' : 'authenticated', isDemo: isDemoMode, hostname }) : getDemoRouteHref(href, isDemoMode, hostname)
}

export function getActiveMobileNavId(
  pathname: string,
  isDemoMode: boolean,
  hostname?: string | null,
): MobileNavId | null {
  const context: NavigationContext = { surface: isDemoMode ? 'demo' : 'authenticated', isDemo: isDemoMode, hostname }
  const active = getActiveNavigationId(pathname, context)
  if (active === 'overview') return 'widgets'
  if (active === 'reports') return 'reports'
  if (active === 'table') return 'table'
  if (active === 'journal') return 'journal'
  if (active) return 'more'
  return null
}
