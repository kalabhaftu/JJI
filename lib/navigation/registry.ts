import {
  getDemoHref,
  getDocsHref,
  getMainAppHref,
} from '@/lib/public-surface-routing'

export type NavigationSurface = 'authenticated' | 'demo' | 'public' | 'docs'

export interface NavigationContext {
  surface: NavigationSurface
  isDemo: boolean
  hostname?: string | null | undefined
  capabilities?: ReadonlySet<string>
}

export type NavigationId =
  | 'overview'
  | 'journal'
  | 'reports'
  | 'table'
  | 'accounts'
  | 'playbook'
  | 'backtesting'
  | 'goals'
  | 'assistant'
  | 'data'
  | 'settings'
  | 'docs'
  | 'feedback'
  | 'donate'
  | 'more'

export type NavigationGroup = 'core' | 'tools' | 'assistant' | 'utilities' | 'mobile-primary' | 'mobile-more'

export interface NavigationEntry {
  id: NavigationId
  label: string
  path: string
  groups: readonly NavigationGroup[]
  description?: string
  keywords?: readonly string[]
  capability?: string
}

const entries: readonly NavigationEntry[] = [
  { id: 'overview', label: 'Overview', path: '/dashboard', groups: ['core', 'mobile-primary'], description: 'Go to the main dashboard', keywords: ['home', 'main', 'widgets'] },
  { id: 'journal', label: 'Journal', path: '/dashboard/journal', groups: ['core', 'mobile-primary'], description: 'Open your trading journal', keywords: ['notes', 'log', 'review'] },
  { id: 'table', label: 'Trades', path: '/dashboard/table', groups: ['core', 'mobile-primary'], description: 'Open the trade table', keywords: ['history', 'list', 'executions'] },
  { id: 'reports', label: 'Reports', path: '/dashboard/reports', groups: ['core', 'mobile-primary'], description: 'Open performance reports', keywords: ['stats', 'analytics', 'performance'] },
  { id: 'accounts', label: 'Accounts', path: '/dashboard/accounts', groups: ['core', 'mobile-more'], description: 'Manage live and prop-firm accounts', keywords: ['broker', 'prop firm'] },
  { id: 'playbook', label: 'Playbook', path: '/dashboard/playbook', groups: ['tools', 'mobile-more'], description: 'Open setups and strategy rules', keywords: ['strategies', 'setups', 'rules'] },
  { id: 'backtesting', label: 'Backtesting', path: '/dashboard/backtesting', groups: ['tools', 'mobile-more'], description: 'Review and log backtests', keywords: ['test', 'simulate', 'paper'] },
  { id: 'goals', label: 'Goals', path: '/dashboard/goals', groups: ['tools', 'mobile-more'] },
  { id: 'assistant', label: 'Assistant', path: '/dashboard/ai', groups: ['assistant', 'mobile-more'] },
  { id: 'data', label: 'Data', path: '/dashboard/data', groups: ['utilities', 'mobile-more'] },
  { id: 'settings', label: 'Settings', path: '/dashboard/settings', groups: ['utilities', 'mobile-more'], description: 'Open app settings', keywords: ['preferences', 'config', 'options'] },
  { id: 'docs', label: 'Documentation', path: '/docs', groups: ['utilities', 'mobile-more'] },
  { id: 'feedback', label: 'Feedback', path: '/feedback', groups: ['utilities'] },
  { id: 'donate', label: 'Donate', path: '/donate', groups: ['utilities'] },
  { id: 'more', label: 'More', path: '#more', groups: ['mobile-primary'] },
] as const

export const NAVIGATION_ENTRIES: readonly NavigationEntry[] = entries

export function getNavigationEntry(id: NavigationId): NavigationEntry {
  const entry = entries.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`Unknown navigation entry: ${id}`)
  return entry
}

export function resolveNavigationPath(entryOrId: NavigationEntry | NavigationId, context: NavigationContext): string {
  const entry = typeof entryOrId === 'string' ? getNavigationEntry(entryOrId) : entryOrId
  if (entry.path.startsWith('#')) return entry.path
  if (entry.path.startsWith('/dashboard')) {
    return context.isDemo || context.surface === 'demo'
      ? getDemoHref(entry.path, context.hostname)
      : entry.path
  }
  if (entry.path.startsWith('/docs')) return getDocsHref(entry.path, context.hostname)
  return getMainAppHref(entry.path, context.hostname)
}

export function getNavigationEntries(context: NavigationContext): readonly NavigationEntry[] {
  return entries.filter((entry) => !entry.capability || context.capabilities?.has(entry.capability))
}

export function getNavigationGroup(group: NavigationGroup, context: NavigationContext): readonly NavigationEntry[] {
  return getNavigationEntries(context).filter((entry) => entry.groups.includes(group))
}

export function getPrimaryMobileNavigation(context: NavigationContext): readonly NavigationEntry[] {
  return getNavigationGroup('mobile-primary', context)
}

export function getMoreNavigation(context: NavigationContext): readonly NavigationEntry[] {
  return getNavigationGroup('mobile-more', context)
}

function pathnameOnly(href: string): string {
  try {
    return new URL(href, 'https://justjournalit.site').pathname
  } catch {
    return href.split(/[?#]/)[0] ?? href
  }
}

export function getActiveNavigationId(pathname: string, context: NavigationContext): NavigationId | null {
  const candidates = getNavigationEntries(context)
    .filter((entry) => !entry.path.startsWith('#'))
    .map((entry) => ({ entry, path: pathnameOnly(resolveNavigationPath(entry, context)) }))
    .filter(({ path }) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.path.length - a.path.length)

  return candidates[0]?.entry.id ?? null
}
