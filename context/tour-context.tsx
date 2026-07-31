'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUserStore } from '@/store/user-store'
import { toast } from 'sonner'
import { useData } from '@/context/data-provider'
import { clearAccountsCache } from '@/hooks/use-accounts'
import { logger } from '@/lib/logger'

export type TourId = 'onboarding' | 'dashboard' | 'analytics' | 'settings'

export interface TourStep {
  id: string
  title: string
  content: string
  targetSelector?: string // If null, renders as centered modal overlay
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  route?: string // Route the user must be on for this step
  actionType?: 'click' | 'input' | 'none' // User action to unlock Next
  actionTarget?: string // Selector that user must interact with
  contrastMessage?: string // Optional contrast explanation ("Why you aren't here")
  desktopOnly?: boolean // Skip this step on mobile
  icon?: string // Optional Lucide icon mapping identifier
}

interface OnboardingStatus {
  core_onboarding_completed: boolean
  dashboard_tour_completed: boolean
  analytics_tour_completed: boolean
  settings_tour_completed: boolean
  last_updated?: string
}

interface TourContextType {
  activeTour: TourId | null
  stepIndex: number
  currentStep: TourStep | null
  paused: boolean
  onboardingStatus: OnboardingStatus | null
  startTour: (tourId: TourId) => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
  completeTour: () => void
  resumeTour: () => void
  pauseTour: () => void
  isTargetVisible: boolean
  isLoadingTarget: boolean
  totalSteps: number
}

const TourContext = createContext<TourContextType | undefined>(undefined)

const DEFAULT_ONBOARDING_STATUS: OnboardingStatus = {
  core_onboarding_completed: false,
  dashboard_tour_completed: false,
  analytics_tour_completed: false,
  settings_tour_completed: false,
}

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter()
  const pathname = usePathname()
  const storeUser = useUserStore((state) => state.user)
  const setDbUser = useUserStore((state) => state.setUser)
  const isMobile = useUserStore((state) => state.isMobile)
  const { accounts } = useData()

  const [activeTour, setActiveTour] = useState<TourId | null>(null)
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [paused, setPaused] = useState<boolean>(false)
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null)
  const [isTargetVisible, setIsTargetVisible] = useState<boolean>(false)
  const [isLoadingTarget, setIsLoadingTarget] = useState<boolean>(false)

  const targetCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const targetTimeout = useRef<NodeJS.Timeout | null>(null)

  const initialAccountIds = useRef<string[]>([])
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null)
  const [createdAccountType, setCreatedAccountType] = useState<'live' | 'prop-firm' | null>(null)

  const tours: Record<TourId, TourStep[]> = {
    onboarding: [
      {
        id: 'welcome',
        title: 'Welcome to JJI',
        content: 'Your advanced trading analytics platform. Let\'s take a quick walkthrough to set up your account, import sample trades, and explore the layout. (Note: For the full CSV import experience, using a desktop browser is recommended.)',
        placement: 'center',
        route: '/dashboard',
        actionType: 'none',
        icon: 'welcome',
      },
      {
        id: 'navbar-accounts',
        title: 'Account Selector',
        content: 'Use this selector in the header to filter all dashboard widgets by one or multiple trading portfolios simultaneously.',
        targetSelector: '[data-tour="navbar-accounts-btn"]',
        placement: 'bottom',
        route: '/dashboard',
        desktopOnly: true,
        icon: 'accounts',
      },
      {
        id: 'widget-canvas',
        title: 'Dynamic Widget Canvas',
        content: 'This is your main dashboard workspace. Widgets are fully responsive, updating in real-time as you log or import trades.',
        targetSelector: '[data-tour="widget-canvas"]',
        placement: 'top',
        route: '/dashboard',
        icon: 'layout',
      },
      {
        id: 'sidebar-accounts',
        title: 'Manage Portfolios',
        content: 'Let\'s set up a trading account first. Click \'Portfolios\' in the sidebar (or the bottom navigation bar on mobile) to go to the Accounts manager.',
        targetSelector: '[data-tour="sidebar-accounts"]',
        placement: 'right',
        route: '/dashboard',
        icon: 'navigation',
      },
      {
        id: 'accounts-welcome',
        title: 'Accounts and Portfolios',
        content: 'Welcome to the Accounts page! Here you can manage your Live portfolios and Prop Firm challenges.',
        placement: 'center',
        route: '/dashboard/accounts',
        icon: 'welcome',
      },
      {
        id: 'new-account-trigger',
        title: 'Create New Portfolio',
        content: 'Click the \'New Account\' button to open the options dropdown.',
        targetSelector: '[data-tour="add-account-btn"]',
        placement: 'bottom',
        route: '/dashboard/accounts',
        actionType: 'click',
        actionTarget: '[data-tour="add-account-btn"]',
        icon: 'add',
      },
      {
        id: 'open-live-dialog',
        title: 'Open Live Account Form',
        content: 'Choose \'Live Account\' to trade personal capital (or choose \'Prop Firm\' for challenge rules). Click \'Live Account\' to open the creation dialog.',
        targetSelector: '[data-tour="create-live-item"]',
        placement: 'left',
        route: '/dashboard/accounts',
        actionType: 'click',
        actionTarget: '[data-tour="create-live-item"]',
        icon: 'add',
      },
      {
        id: 'enter-account-name',
        title: 'Choose Account Name',
        content: 'Enter a name for your portfolio, such as \'Demo Tour Account\'.',
        targetSelector: 'input[id="name"], input[id="accountName"]',
        placement: 'bottom',
        route: '/dashboard/accounts',
        actionType: 'input',
        actionTarget: 'input[id="name"], input[id="accountName"]',
        icon: 'edit',
      },
      {
        id: 'enter-account-number',
        title: 'Enter Account Number',
        content: 'Type in any sample account number (minimum 6 digits) to identify this portfolio.',
        targetSelector: 'input[id="number"], input[id="phase1AccountId"]',
        placement: 'bottom',
        route: '/dashboard/accounts',
        actionType: 'input',
        actionTarget: 'input[id="number"], input[id="phase1AccountId"]',
        icon: 'edit',
      },
      {
        id: 'submit-account',
        title: 'Save Portfolio',
        content: 'Click \'Create Account\' to save this portfolio. This will register the new account in the database.',
        targetSelector: '[data-tour="create-account-submit"]',
        placement: 'top',
        route: '/dashboard/accounts',
        actionType: 'click',
        actionTarget: '[data-tour="create-account-submit"]',
        icon: 'check',
      },
      {
        id: 'csv-download',
        title: 'Generate Mock Trades',
        content: 'To demonstrate the import system, we have generated and downloaded a \'sample_trades.csv\' file to your computer. Click Next to import it!',
        placement: 'center',
        route: '/dashboard/accounts',
        icon: 'import',
      },
      {
        id: 'click-import-btn',
        title: 'Import Dialog',
        content: 'Let\'s load the sample trades. Click the \'Import Trades\' button in the navigation header to open the parser dialog.',
        targetSelector: '[data-tour="import-nav-btn"]',
        placement: 'bottom',
        route: '/dashboard/accounts',
        actionType: 'click',
        actionTarget: '[data-tour="import-nav-btn"]',
        icon: 'import',
      },
      {
        id: 'select-universal-platform',
        title: 'Universal CSV Importer',
        content: 'Click \'Universal Import\' to use our smart column-matching CSV processor.',
        targetSelector: '[data-tour="platform-item-universal"]',
        placement: 'right',
        route: '/dashboard/accounts',
        actionType: 'click',
        actionTarget: '[data-tour="platform-item-universal"]',
        icon: 'info',
      },
      {
        id: 'upload-csv-file',
        title: 'Dropzone Upload',
        content: 'Drag and drop the \'sample_trades.csv\' file we downloaded earlier into this dropzone, or click to select it from your files. (Mobile users: you can click Next to simulate).',
        targetSelector: '[data-tour="file-upload-dropzone"]',
        placement: 'bottom',
        route: '/dashboard/accounts',
        icon: 'import',
      },
      {
        id: 'select-import-account',
        title: 'Link to Portfolio',
        content: 'Click to select your newly created demo account to associate these trades with it.',
        targetSelector: '[data-tour="import-account-card"]',
        placement: 'bottom',
        route: '/dashboard/accounts',
        actionType: 'click',
        actionTarget: '[data-tour="import-account-card"]',
        icon: 'accounts',
      },
      {
        id: 'import-dialog-next',
        title: 'Process Trades',
        content: 'Click \'Next\' to parse the CSV and review the imported trades.',
        targetSelector: '[data-tour="import-next-btn"]',
        placement: 'top',
        route: '/dashboard/accounts',
        actionType: 'click',
        actionTarget: '[data-tour="import-next-btn"]',
        icon: 'import',
      },
      {
        id: 'confirm-import',
        title: 'Save Trades',
        content: 'Review the processed trades in the list, then click \'Save Trades\' to link them to your selected portfolio.',
        targetSelector: '[data-tour="import-next-btn"]',
        placement: 'top',
        route: '/dashboard/accounts',
        actionType: 'click',
        actionTarget: '[data-tour="import-next-btn"]',
        icon: 'check',
      },
      {
        id: 'navigate-trade-log',
        title: 'Explore Trade Log',
        content: 'Great! Let\'s view the imported trades. Click \'Trade Log\' in the sidebar to inspect the detailed list.',
        targetSelector: '[data-tour="sidebar-table"]',
        placement: 'right',
        route: '/dashboard/accounts',
        actionType: 'click',
        actionTarget: '[data-tour="sidebar-table"]',
        icon: 'navigation',
      },
      {
        id: 'table-row-explain',
        title: 'Trades Table',
        content: 'Here is your detailed ledger of imported trades. You can inspect profit/loss, win status, holding times, and use the View/Edit buttons to manage individual trades.',
        targetSelector: '[data-tour="trade-row-first"]',
        placement: 'bottom',
        route: '/dashboard/table',
        icon: 'info',
      },
      {
        id: 'view-trade-trigger',
        title: 'View Trade Details',
        content: 'Click the \'View\' button on the first trade to inspect execution statistics, tags, strategy rules, and economic context.',
        targetSelector: '[data-tour="view-trade-btn"]',
        placement: 'bottom',
        route: '/dashboard/table',
        actionType: 'click',
        actionTarget: '[data-tour="view-trade-btn"]',
        icon: 'view',
      },
      {
        id: 'close-trade-detail',
        title: 'Close Detail Panel',
        content: 'Here is the comprehensive trade view. When you are done exploring, click \'Back\' to close this panel and return to the main table.',
        targetSelector: '[data-tour="close-trade-detail"]',
        placement: 'right',
        route: '/dashboard/table',
        actionType: 'click',
        actionTarget: '[data-tour="close-trade-detail"]',
        icon: 'navigation',
      },
      {
        id: 'navigate-journal',
        title: 'Daily Journal',
        content: 'Finally, let\'s look at the Daily Journal. Click \'Daily Journal\' in the sidebar to see how trades are grouped by date.',
        targetSelector: '[data-tour="sidebar-journal"]',
        placement: 'right',
        route: '/dashboard/table',
        actionType: 'click',
        actionTarget: '[data-tour="sidebar-journal"]',
        icon: 'navigation',
      },
      {
        id: 'tour-cleanup',
        title: 'Journal Overview and Cleanup',
        content: 'The Daily Journal groups trades by day and lets you attach notes or review daily PnL. The demo account and imported trades will be deleted automatically next to clean up.',
        targetSelector: '[data-tour="journal-view-cards-btn"]',
        placement: 'bottom',
        route: '/dashboard/journal',
        icon: 'check',
      },
    ],
    dashboard: [
      {
        id: 'db-welcome',
        title: 'Trading Dashboard',
        content: 'This is your central command. You can track performance metrics, inspect charts, and view recent activity at a glance.',
        placement: 'center',
        route: '/dashboard',
        icon: 'welcome',
      },
      {
        id: 'db-accounts',
        title: 'Multi-Portfolio Accounts',
        content: 'Click here to filter the dashboard by specific portfolios. You can select one or multiple accounts simultaneously.',
        targetSelector: '[data-tour="navbar-accounts-btn"]',
        placement: 'bottom',
        route: '/dashboard',
        icon: 'accounts',
      },
      {
        id: 'db-import',
        title: 'Import Trades Parser',
        content: 'Click here to import your trades from any broker or platform using our universal CSV drag-and-drop importer.',
        targetSelector: '[data-tour="import-nav-btn"]',
        placement: 'bottom',
        route: '/dashboard',
        icon: 'import',
      },
      {
        id: 'db-quick-add',
        title: 'Quick Add Trade',
        content: 'Need to log a single trade quickly? Use the Quick Add FAB to manually input a trade with strategies, execution details, and notes.',
        targetSelector: '[data-tour="quick-add-btn"]',
        placement: 'bottom',
        route: '/dashboard',
        icon: 'add',
      },
      {
        id: 'db-theme',
        title: 'Theme Switcher',
        content: 'Toggle dark mode and light mode instantly depending on your environmental preferences.',
        targetSelector: '[data-tour="theme-switcher-btn"]',
        placement: 'bottom',
        route: '/dashboard',
        icon: 'theme',
      },
      {
        id: 'db-sidebar-nav',
        title: 'Sidebar Navigation',
        content: 'Easily jump between your Trading Dashboard, Trade Log table, Daily Journal, Analytics Reports, or Settings.',
        targetSelector: '[data-tour="sidebar-table"]',
        placement: 'right',
        route: '/dashboard',
        icon: 'navigation',
      },
      {
        id: 'db-canvas',
        title: 'Dynamic Widget Canvas',
        content: 'Your main dashboard workspace. View win rate, P&L, hold times, and recent history cards here. Click "Got it" to complete the tour.',
        targetSelector: '[data-tour="widget-canvas"]',
        placement: 'top',
        route: '/dashboard',
        icon: 'complete',
      },
    ],
    analytics: [
      {
        id: 'analytics-welcome',
        title: 'Performance Reports',
        content: 'View win rate distribution, average holding times, cumulative PnL, and advanced metrics.',
        placement: 'center',
        route: '/dashboard/reports',
        icon: 'welcome',
      },
      {
        id: 'reports-tab-overview',
        title: 'Performance Overview',
        content: 'The Overview tab displays your Audit Statement, including Net PnL, Win Rate, Profit Factor, Max Drawdown, and R-Multiple distribution.',
        targetSelector: '[data-tour="reports-tab-overview"]',
        placement: 'bottom',
        route: '/dashboard/reports',
        icon: 'layout',
      },
      {
        id: 'reports-tab-sessions',
        title: 'Sessions & Timing Analysis',
        content: 'Click the "Sessions" tab to view performance metrics grouped by time of day and trading sessions (Asian, London, New York).',
        targetSelector: '[data-tour="reports-tab-sessions"]',
        placement: 'bottom',
        route: '/dashboard/reports',
        actionType: 'click',
        actionTarget: '[data-tour="reports-tab-sessions"]',
        icon: 'navigation',
      },
      {
        id: 'reports-tab-spreadsheet',
        title: 'Spreadsheet Grid View',
        content: 'Click the "Spreadsheet" tab to display and audit all your trade records in a tabular format for review.',
        targetSelector: '[data-tour="reports-tab-spreadsheet"]',
        placement: 'bottom',
        route: '/dashboard/reports',
        actionType: 'click',
        actionTarget: '[data-tour="reports-tab-spreadsheet"]',
        icon: 'navigation',
      },
      {
        id: 'reports-tab-statement',
        title: 'Formal Account Statement',
        content: 'Click the "Statement" tab to generate a downloadable, detailed financial statement of all execution metrics.',
        targetSelector: '[data-tour="reports-tab-statement"]',
        placement: 'bottom',
        route: '/dashboard/reports',
        actionType: 'click',
        actionTarget: '[data-tour="reports-tab-statement"]',
        icon: 'navigation',
      },
      {
        id: 'reports-tab-propfirm',
        title: 'Funded & Challenge Tracking',
        content: 'Click the "Funded" tab to track your Prop Firm challenge requirements, including active phase profit targets and drawdown rules.',
        targetSelector: '[data-tour="reports-tab-propfirm"]',
        placement: 'bottom',
        route: '/dashboard/reports',
        actionType: 'click',
        actionTarget: '[data-tour="reports-tab-propfirm"]',
        icon: 'navigation',
      },
    ],
    settings: [
      {
        id: 'settings-welcome',
        title: 'Account Settings',
        content: 'Configure personal details, timezone adjustments, dashboard layout resets, and webhook integrations.',
        placement: 'center',
        route: '/dashboard/settings',
        icon: 'settings',
      },
      {
        id: 'settings-tab-profile',
        title: 'Profile & Plan Settings',
        content: 'The "Profile & Plan" section allows you to update your name, email, avatar, and view your current subscription tier.',
        targetSelector: '[data-tour="settings-tab-profile"]',
        placement: 'bottom',
        route: '/dashboard/settings',
        icon: 'accounts',
      },
      {
        id: 'settings-card-profile',
        title: 'Update Profile Details',
        content: 'Change your personal info here, adjust local configurations, and select how Net PnL is displayed.',
        targetSelector: '[data-tour="settings-card-profile"]',
        placement: 'top',
        route: '/dashboard/settings',
        icon: 'edit',
      },
      {
        id: 'settings-tab-preferences',
        title: 'Platform Preferences',
        content: 'Click the "Preferences" tab to configure UI layout choices, chart rendering styles, and local system presets.',
        targetSelector: '[data-tour="settings-tab-preferences"]',
        placement: 'bottom',
        route: '/dashboard/settings',
        actionType: 'click',
        actionTarget: '[data-tour="settings-tab-preferences"]',
        icon: 'navigation',
      },
      {
        id: 'settings-card-preferences',
        title: 'Manage Preferences',
        content: 'Switch color themes (dark, light, or system), toggles for chart types (smooth vs sharp curves), and adjust regional options.',
        targetSelector: '[data-tour="settings-card-preferences"]',
        placement: 'top',
        route: '/dashboard/settings',
        icon: 'layout',
      },
      {
        id: 'settings-tab-integrations',
        title: 'Integrations & Webhooks',
        content: 'Click the "Integrations" tab to connect to third-party services and set up automated trading endpoints.',
        targetSelector: '[data-tour="settings-tab-integrations"]',
        placement: 'bottom',
        route: '/dashboard/settings',
        actionType: 'click',
        actionTarget: '[data-tour="settings-tab-integrations"]',
        icon: 'navigation',
      },
      {
        id: 'settings-card-integrations',
        title: 'TradingView Webhooks',
        content: 'Use this webhook URL and JSON message payload to auto-import your trades directly from TradingView alerts in real-time.',
        targetSelector: '[data-tour="settings-card-integrations"]',
        placement: 'top',
        route: '/dashboard/settings',
        icon: 'import',
      },
      {
        id: 'settings-tab-connections',
        title: 'Linked Accounts',
        content: 'Click the "Linked Accounts" tab to manage social authentication and secure login providers.',
        targetSelector: '[data-tour="settings-tab-connections"]',
        placement: 'bottom',
        route: '/dashboard/settings',
        actionType: 'click',
        actionTarget: '[data-tour="settings-tab-connections"]',
        icon: 'navigation',
      },
      {
        id: 'settings-card-connections',
        title: 'Social Identity Connections',
        content: 'Link or unlink Google and GitHub authentication to simplify logging into your JJI workspace.',
        targetSelector: '[data-tour="settings-card-connections"]',
        placement: 'top',
        route: '/dashboard/settings',
        icon: 'check',
      },
      {
        id: 'settings-tab-security',
        title: 'Security & Data Controls',
        content: 'Click the "Security & Data" tab to handle caching, backup exports, and critical account operations.',
        targetSelector: '[data-tour="settings-tab-security"]',
        placement: 'bottom',
        route: '/dashboard/settings',
        actionType: 'click',
        actionTarget: '[data-tour="settings-tab-security"]',
        icon: 'navigation',
      },
      {
        id: 'settings-card-security',
        title: 'Local Cache and resets',
        content: 'Clear cached data, reset your tutorial progress state, export your raw database, or delete your account here.',
        targetSelector: '[data-tour="settings-card-security"]',
        placement: 'top',
        route: '/dashboard/settings',
        icon: 'complete',
      },
    ],
  }

  const currentSteps = activeTour ? tours[activeTour] : []
  const currentStep = activeTour && currentSteps[stepIndex] ? currentSteps[stepIndex] : null

  useEffect(() => {
    if (storeUser) {
      const dbStatus = (storeUser as any).onboardingStatus
      if (dbStatus && typeof dbStatus === 'object') {
        setOnboardingStatus({
          core_onboarding_completed: !!dbStatus.core_onboarding_completed,
          dashboard_tour_completed: !!dbStatus.dashboard_tour_completed,
          analytics_tour_completed: !!dbStatus.analytics_tour_completed,
          settings_tour_completed: !!dbStatus.settings_tour_completed,
          last_updated: dbStatus.last_updated,
        })
      } else {
        setOnboardingStatus(DEFAULT_ONBOARDING_STATUS)
      }
    }
  }, [storeUser])

  const startTour = useCallback((tourId: TourId) => {
    setActiveTour(tourId)
    setStepIndex(0)
    setPaused(false)
    if (tourId === 'onboarding') {
      setCreatedAccountId(null)
      setCreatedAccountType(null)
      initialAccountIds.current = accounts ? accounts.map((a: any) => a.id) : []
    }
  }, [accounts])

  useEffect(() => {
    if (
      onboardingStatus &&
      onboardingStatus.core_onboarding_completed === false &&
      activeTour === null &&
      pathname === '/dashboard' &&
      !paused
    ) {
      const timer = setTimeout(() => {
        startTour('onboarding')
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [onboardingStatus, activeTour, pathname, paused, startTour])

  const saveOnboardingStatus = useCallback(async (updatedStatus: Partial<OnboardingStatus>) => {
    if (!storeUser) return

    const nextStatus = {
      ...onboardingStatus,
      ...updatedStatus,
      last_updated: new Date().toISOString(),
    }

    setOnboardingStatus(nextStatus as OnboardingStatus)

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingStatus: nextStatus }),
      })
      const result = await response.json()
      if (result.success && result.data) {
        setDbUser(result.data)
      }
    } catch (error) {
      logger.error({ error }, 'Failed to save onboarding status:')
    }
  }, [storeUser, onboardingStatus, setDbUser])

  const skipTour = async () => {
    if (!activeTour) return

    const keyMap: Record<TourId, keyof OnboardingStatus> = {
      onboarding: 'core_onboarding_completed',
      dashboard: 'dashboard_tour_completed',
      analytics: 'analytics_tour_completed',
      settings: 'settings_tour_completed',
    }

    if (activeTour === 'onboarding' && createdAccountId) {
      try {
        const endpoint = createdAccountType === 'prop-firm'
          ? `/api/v1/prop-firm/accounts/${createdAccountId}`
          : `/api/v1/accounts/${createdAccountId}`

        await fetch(endpoint, { method: 'DELETE' })
        clearAccountsCache()
      } catch (error) {
        logger.error({ error }, 'Failed to delete onboarding demo account on skip:')
      }
    }

    saveOnboardingStatus({ [keyMap[activeTour]]: true })
    setActiveTour(null)
    setPaused(false)
    toast.success('Tour skipped. You can restart it anytime from settings.')
  }

  const completeTour = useCallback(async () => {
    if (!activeTour) return

    const keyMap: Record<TourId, keyof OnboardingStatus> = {
      onboarding: 'core_onboarding_completed',
      dashboard: 'dashboard_tour_completed',
      analytics: 'analytics_tour_completed',
      settings: 'settings_tour_completed',
    }

    if (activeTour === 'onboarding' && createdAccountId) {
      const toastId = toast.loading('Completing onboarding and cleaning up demo portfolio...')
      try {
        const endpoint = createdAccountType === 'prop-firm'
          ? `/api/v1/prop-firm/accounts/${createdAccountId}`
          : `/api/v1/accounts/${createdAccountId}`

        const response = await fetch(endpoint, { method: 'DELETE' })
        if (response.ok) {
          clearAccountsCache()
          toast.success('Demo account deleted to keep workspace clean!', { id: toastId })
        } else {
          toast.error('Failed to clean up demo account.', { id: toastId })
        }
      } catch (error) {
        logger.error({ error }, 'Failed to delete onboarding demo account:')
        toast.error('Error cleaning up demo account.', { id: toastId })
      }
    }

    saveOnboardingStatus({ [keyMap[activeTour]]: true })
    setActiveTour(null)
    setPaused(false)

    if (activeTour === 'onboarding') {
      router.push('/dashboard')
    } else {
      toast.success('Tour completed.')
    }
  }, [activeTour, createdAccountId, createdAccountType, router, saveOnboardingStatus])

  const nextStep = useCallback(() => {
    if (!activeTour) return

    if (stepIndex < currentSteps.length - 1) {
      setStepIndex((prev) => prev + 1)
    } else {
      completeTour()
    }
  }, [activeTour, stepIndex, currentSteps.length, completeTour])

  const prevStep = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1)
    }
  }, [stepIndex])

  const pauseTour = () => {
    setPaused(true)
  }

  const resumeTour = () => {
    setPaused(false)
    if (currentStep?.route && pathname !== currentStep.route) {
      router.push(currentStep.route as any)
    }
  }

  // Listen for the custom account-created event (instant detection)
  useEffect(() => {
    const handleAccountCreated = (e: Event) => {
      const customEvent = e as CustomEvent
      const { id, type } = customEvent.detail || {}
      if (id && type && !createdAccountId) {
        setCreatedAccountId(id)
        setCreatedAccountType(type)
        
        if (currentStep?.id === 'submit-account') {
          nextStep()
        }
      }
    }

    document.addEventListener('jji-account-created', handleAccountCreated)
    return () => {
      document.removeEventListener('jji-account-created', handleAccountCreated)
    }
  }, [createdAccountId, currentStep, nextStep])

  // Fallback: Detect newly created account in onboarding via list diffing
  useEffect(() => {
    if (activeTour === 'onboarding' && accounts && accounts.length > 0) {
      const newAcc = accounts.find((a: any) => !initialAccountIds.current.includes(a.id))
      if (newAcc && !createdAccountId) {
        setCreatedAccountId(newAcc.id)
        setCreatedAccountType(newAcc.accountType || 'live')
        
        if (currentStep?.id === 'submit-account') {
          nextStep()
        }
      }
    }
  }, [accounts, activeTour, createdAccountId, currentStep, nextStep])

  useEffect(() => {
    if (activeTour === 'onboarding' && currentStep?.id === 'csv-download') {
      const timer = setTimeout(() => {
        downloadSampleCSV()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [activeTour, currentStep])

  const downloadSampleCSV = () => {
    try {
      const headers = ["Symbol", "Side", "Quantity", "Entry Price", "Close Price", "Entry Date", "Close Date", "PnL"]
      const rows = [
        ["EURUSD", "Buy", "1.0", "1.0850", "1.0900", "2026-06-08 09:00:00", "2026-06-08 10:00:00", "500.00"],
        ["GBPUSD", "Sell", "1.5", "1.2650", "1.2600", "2026-06-08 10:30:00", "2026-06-08 12:00:00", "750.00"],
        ["USDJPY", "Buy", "2.0", "155.20", "154.80", "2026-06-08 13:00:00", "2026-06-08 14:15:00", "-800.00"]
      ]
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", "sample_trades.csv")
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success("Sample CSV file downloaded successfully!")
    } catch (e) {
      logger.error({ error: e }, "Failed to generate sample CSV:")
    }
  }

  useEffect(() => {
    if (!activeTour || !currentStep || paused) {
      setIsTargetVisible(false)
      setIsLoadingTarget(false)
      return
    }

    if (currentStep.route && pathname !== currentStep.route) {
      setIsLoadingTarget(true)
      router.push(currentStep.route as any)
      return
    }

    if (currentStep.desktopOnly && isMobile) {
      nextStep()
      return
    }

    // If step has no target selector, it's a modal
    if (!currentStep.targetSelector) {
      setIsTargetVisible(true)
      setIsLoadingTarget(false)
      return
    }

    setIsTargetVisible(false)
    setIsLoadingTarget(true)

    if (targetCheckInterval.current) clearInterval(targetCheckInterval.current)
    if (targetTimeout.current) clearTimeout(targetTimeout.current)

    // Poll for the target element to handle rendering delays / network loading
    let attempts = 0
    targetCheckInterval.current = setInterval(() => {
      const el = document.querySelector(currentStep.targetSelector!)
      attempts++

      if (el) {
        setIsTargetVisible(true)
        setIsLoadingTarget(false)
        clearInterval(targetCheckInterval.current!)
        targetCheckInterval.current = null
      } else if (attempts >= 15) {
        clearInterval(targetCheckInterval.current!)
        targetCheckInterval.current = null
        setIsLoadingTarget(false)
        if (stepIndex > 0) {
          prevStep()
          toast.info('Dropdown closed or target not found. Rewinding one step. Please click the trigger again to continue the tour.', { duration: 4000 })
        } else {
          pauseTour()
          toast.info('Tour paused. Click the resume widget to continue when ready.', { duration: 4000 })
        }
      }
    }, 500)

    return () => {
      if (targetCheckInterval.current) clearInterval(targetCheckInterval.current)
    }
  }, [activeTour, stepIndex, pathname, paused, isMobile, currentStep, nextStep, prevStep, router])

  // Setup interactive listeners if step requires real user interaction (using Capture Phase listeners to bypass Radix event prevention)
  useEffect(() => {
    if (!activeTour || !currentStep || paused || !isTargetVisible) return

    const { actionType, actionTarget } = currentStep
    if (!actionType || !actionTarget) return

    let actionFired = false
    const handleAction = () => {
      if (actionFired) return
      actionFired = true
      setTimeout(() => {
        nextStep()
      }, 305)
    }

    const handleCaptureAction = (e: Event) => {
      if (actionFired) return
      const target = e.target as Element | null
      if (target) {
        const matched = target.closest(actionTarget)
        if (matched) {
          handleAction()
        }
      }
    }

    if (actionType === 'click') {
      document.addEventListener('click', handleCaptureAction, { capture: true })
      document.addEventListener('mousedown', handleCaptureAction, { capture: true })
      document.addEventListener('pointerdown', handleCaptureAction, { capture: true })
    } else if (actionType === 'input') {
      document.addEventListener('input', handleCaptureAction, { capture: true })
    }

    return () => {
      if (actionType === 'click') {
        document.removeEventListener('click', handleCaptureAction, { capture: true })
        document.removeEventListener('mousedown', handleCaptureAction, { capture: true })
        document.removeEventListener('pointerdown', handleCaptureAction, { capture: true })
      } else if (actionType === 'input') {
        document.removeEventListener('input', handleCaptureAction, { capture: true })
      }
    }
  }, [activeTour, stepIndex, isTargetVisible, paused, currentStep, nextStep])


  return (
    <TourContext.Provider
      value={{
        activeTour,
        stepIndex,
        currentStep,
        paused,
        onboardingStatus,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
        resumeTour,
        pauseTour,
        isTargetVisible,
        isLoadingTarget,
        totalSteps: currentSteps.length,
      }}
    >
      {children}
    </TourContext.Provider>
  )
}

export const useTour = () => {
  const context = useContext(TourContext)
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider')
  }
  return context
}
