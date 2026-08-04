'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Calendar as CalendarBlank,
  FileText,
  FlaskConical as Flask,
  LayoutGrid as SquaresFour,
  Moon,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Sun,
  Table,
  Users,
  BarChart3 as ChartBar,
  type LucideIcon,
} from 'lucide-react'

import { useTheme } from '@/context/theme-provider'
import { useData } from '@/context/data-provider'
import { usePublicSurfaceRouting } from '@/hooks/use-public-surface-routing'
import { useQuickAddStore } from '@/store/quick-add-store'
import { getNavigationEntry, resolveNavigationPath, type NavigationContext, type NavigationId } from '@/lib/navigation/registry'
import { buildTradeEntryHref } from '@/app/dashboard/trades/new/trade-entry-draft'

interface DashboardShellAction {
  id: string
  title: string
  description: string
  icon: LucideIcon
  keywords: string[]
  perform: () => void
}

export interface DashboardShellActionGroup {
  id: string
  heading: string
  items: DashboardShellAction[]
}

export function useDashboardShellActionGroups(): DashboardShellActionGroup[] {
  const router = useRouter()
  const { theme, toggleTheme, setTheme } = useTheme()
  const { refreshTrades, isDemoMode } = useData()
  const { hostname } = usePublicSurfaceRouting()
  const openQuickAdd = useQuickAddStore((state) => state.openQuickAdd)
  const routeHref = useCallback((id: NavigationId) => {
    const context: NavigationContext = { surface: isDemoMode ? 'demo' : 'authenticated', isDemo: Boolean(isDemoMode), hostname }
    return resolveNavigationPath(id, context)
  }, [hostname, isDemoMode])
  const navigationEntry = (id: NavigationId) => getNavigationEntry(id)

  return useMemo(
    () => [
      {
        id: 'navigation',
        heading: 'Navigation',
        items: [
          {
            id: navigationEntry('overview').id,
            title: navigationEntry('overview').label,
            description: navigationEntry('overview').description!,
            icon: SquaresFour,
            perform: () => router.push(routeHref('overview')),
            keywords: [...(navigationEntry('overview').keywords ?? [])],
          },
          {
            id: 'reports',
            title: 'Reports',
            description: 'Open performance reports',
            icon: ChartBar,
            perform: () => router.push(routeHref('reports')),
            keywords: ['stats', 'analytics', 'performance'],
          },
          {
            id: 'journal',
            title: 'Journal',
            description: 'Open your trading journal',
            icon: BookOpen,
            perform: () => router.push(routeHref('journal')),
            keywords: ['notes', 'log', 'review'],
          },
          {
            id: 'accounts',
            title: 'Accounts',
            description: 'Manage live and prop-firm accounts',
            icon: Users,
            perform: () => router.push(routeHref('accounts')),
            keywords: ['broker', 'prop firm'],
          },
          {
            id: 'trades',
            title: 'Trades',
            description: 'Open the trade table',
            icon: Table,
            perform: () => router.push(routeHref('table')),
            keywords: ['history', 'list', 'executions'],
          },
          {
            id: 'playbook',
            title: 'Playbook',
            description: 'Open your setups and strategy rules',
            icon: FileText,
            perform: () => router.push(routeHref('playbook')),
            keywords: ['strategies', 'setups', 'rules'],
          },
          {
            id: 'backtesting',
            title: 'Backtesting',
            description: 'Review and log backtests',
            icon: Flask,
            perform: () => router.push(routeHref('backtesting')),
            keywords: ['test', 'simulate', 'paper'],
          },
          {
            id: 'settings',
            title: 'Settings',
            description: 'Open app settings',
            icon: SettingsIcon,
            perform: () => router.push(routeHref('settings')),
            keywords: ['preferences', 'config', 'options'],
          },
          {
            id: 'calendar',
            title: 'Calendar View',
            description: 'Jump to the dashboard calendar',
            icon: CalendarBlank,
            perform: () => router.push(routeHref('overview')),
            keywords: ['dates', 'pnl', 'monthly'],
          },
        ],
      },
      {
        id: 'actions',
        heading: 'Actions',
        items: [
          {
            id: 'add-trade',
            title: 'Add New Trade',
            description: 'Open the full trade entry workflow',
            icon: Plus,
            perform: () => isDemoMode ? openQuickAdd() : router.push(buildTradeEntryHref({ origin: 'command-palette', returnTo: routeHref('overview') })),
            keywords: ['new', 'create', 'entry', 'order', 'quick add'],
          },
          {
            id: 'refresh-data',
            title: 'Refresh Data',
            description: 'Refresh trade and dashboard data',
            icon: RefreshCw,
            perform: refreshTrades,
            keywords: ['reload', 'sync', 'refresh'],
          },
        ],
      },
      {
        id: 'appearance',
        heading: 'Appearance',
        items: [
          {
            id: 'toggle-theme',
            title: 'Toggle Theme',
            description: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`,
            icon: theme === 'dark' ? Sun : Moon,
            perform: toggleTheme,
            keywords: ['theme', 'dark', 'light', 'mode'],
          },
          {
            id: 'set-light',
            title: 'Light Mode',
            description: 'Set the application theme to light',
            icon: Sun,
            perform: () => setTheme('light'),
            keywords: ['theme', 'light', 'day'],
          },
          {
            id: 'set-dark',
            title: 'Dark Mode',
            description: 'Set the application theme to dark',
            icon: Moon,
            perform: () => setTheme('dark'),
            keywords: ['theme', 'dark', 'night'],
          },
        ],
      },
    ],
    [isDemoMode, openQuickAdd, refreshTrades, router, routeHref, setTheme, theme, toggleTheme]
  )
}
