'use client'

import { useMemo } from 'react'
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
import { useQuickAddStore } from '@/store/quick-add-store'

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
  const openQuickAdd = useQuickAddStore((state) => state.openQuickAdd)

  return useMemo(
    () => [
      {
        id: 'navigation',
        heading: 'Navigation',
        items: [
          {
            id: 'dashboard',
            title: 'Dashboard',
            description: 'Go to the main dashboard',
            icon: SquaresFour,
            perform: () => router.push(isDemoMode ? '/demo' : '/dashboard'),
            keywords: ['home', 'main', 'widgets'],
          },
          {
            id: 'reports',
            title: 'Reports',
            description: 'Open performance reports',
            icon: ChartBar,
            perform: () => router.push(isDemoMode ? '/demo/reports' : '/dashboard/reports'),
            keywords: ['stats', 'analytics', 'performance'],
          },
          {
            id: 'journal',
            title: 'Journal',
            description: 'Open your trading journal',
            icon: BookOpen,
            perform: () => router.push(isDemoMode ? '/demo/journal' : '/dashboard/journal'),
            keywords: ['notes', 'log', 'review'],
          },
          {
            id: 'accounts',
            title: 'Accounts',
            description: 'Manage live and prop-firm accounts',
            icon: Users,
            perform: () => router.push(isDemoMode ? '/demo/accounts' : '/dashboard/accounts'),
            keywords: ['broker', 'prop firm'],
          },
          {
            id: 'trades',
            title: 'Trades',
            description: 'Open the trade table',
            icon: Table,
            perform: () => router.push(isDemoMode ? '/demo/table' : '/dashboard/table'),
            keywords: ['history', 'list', 'executions'],
          },
          {
            id: 'playbook',
            title: 'Playbook',
            description: 'Open your setups and strategy rules',
            icon: FileText,
            perform: () => router.push(isDemoMode ? '/demo/playbook' : '/dashboard/playbook'),
            keywords: ['strategies', 'setups', 'rules'],
          },
          {
            id: 'backtesting',
            title: 'Backtesting',
            description: 'Review and log backtests',
            icon: Flask,
            perform: () => router.push(isDemoMode ? '/demo/backtesting' : '/dashboard/backtesting'),
            keywords: ['test', 'simulate', 'paper'],
          },
          {
            id: 'settings',
            title: 'Settings',
            description: 'Open app settings',
            icon: SettingsIcon,
            perform: () => router.push(isDemoMode ? '/demo/settings' : '/dashboard/settings'),
            keywords: ['preferences', 'config', 'options'],
          },
          {
            id: 'calendar',
            title: 'Calendar View',
            description: 'Jump to the dashboard calendar',
            icon: CalendarBlank,
            perform: () => router.push(isDemoMode ? '/demo' : '/dashboard'),
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
            description: 'Open the lightweight quick-add trade dialog',
            icon: Plus,
            perform: openQuickAdd,
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
    [openQuickAdd, refreshTrades, router, setTheme, theme, toggleTheme, isDemoMode]
  )
}
