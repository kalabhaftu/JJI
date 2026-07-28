import { getDemoAwarePathname, getDemoRouteHref } from '@/lib/public-surface-routing'

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
  return getDemoRouteHref(href, isDemoMode, hostname)
}

export function getActiveMobileNavId(
  pathname: string,
  isDemoMode: boolean,
  hostname?: string | null,
): MobileNavId | null {
  const resolvedPathname = getDemoAwarePathname(pathname, isDemoMode, hostname)
  const base = isDemoMode ? '/demo' : '/dashboard'

  if (resolvedPathname === base) return 'widgets'
  if (resolvedPathname.startsWith(`${base}/reports`)) return 'reports'
  if (resolvedPathname.startsWith(`${base}/table`)) return 'table'
  if (resolvedPathname.startsWith(`${base}/journal`)) return 'journal'
  if (resolvedPathname.startsWith(base)) return 'more'
  return null
}
