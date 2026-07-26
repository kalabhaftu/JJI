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

export function getMobileNavHref(href: string, isDemoMode: boolean): string {
  return isDemoMode ? href.replace('/dashboard', '/demo') : href
}

export function getActiveMobileNavId(
  pathname: string,
  isDemoMode: boolean,
): MobileNavId | null {
  const base = isDemoMode ? '/demo' : '/dashboard'

  if (pathname === base) return 'widgets'
  if (pathname.startsWith(`${base}/reports`)) return 'reports'
  if (pathname.startsWith(`${base}/table`)) return 'table'
  if (pathname.startsWith(`${base}/journal`)) return 'journal'
  if (pathname.startsWith(base)) return 'more'
  return null
}
