'use client'

import { motion } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  BookMarkedIcon,
  Link02Icon,
  Setting06Icon,
  Shield01Icon,
  User02Icon,
  WebhookIcon,
} from '@hugeicons/core-free-icons'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/page-header'
import { useAuth } from '@/context/auth-provider'
import { useTheme } from '@/context/theme-provider'
import { useTour } from '@/context/tour-context'
import { formatBreakevenBand } from '@/lib/metrics/outcome'
import { normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import { reportClientError, reportError } from '@/lib/observability/report-error'
import { ApiClientError, apiRequest } from '@/lib/api/client'
import { getUserAvatarUrl } from '@/lib/user-avatar'
import { useUserStore } from '@/store/user-store'
import { SettingsDialogs } from './components/settings-dialogs'
import { defaultAiSettings } from './components/settings-config'
import { SettingsHelpSection } from './components/settings-help-section'
import { SettingsNavigation, type SettingsSectionId } from './components/settings-navigation'
import { SettingsConnections, SettingsIntegrations, SettingsSecurity } from './components/settings-panels'
import { SettingsPreferencesSection } from './components/settings-preferences-section'
import { SettingsProfileSection } from './components/settings-profile-section'
import { SettingsHeader, SettingsShell } from './components/settings-shell'
import type { SettingsProfileData, SettingsSubscriptionData } from './components/settings-types'
import { useSettingsPreferences } from './hooks/use-settings-preferences'

function reportSettingsMutationError(error: unknown, operation: string) {
  reportClientError(error, {
    operation,
    route: '/dashboard/settings',
  })
}

function getDeleteAccountErrorDescription(error: unknown): string {
  if (error instanceof ApiClientError && error.status === 429) {
    const waitSeconds = error.retryAfterSeconds ?? 300
    return `Too many requests. Please wait ${waitSeconds} seconds before trying again.`
  }

  if (error instanceof ApiClientError && error.status >= 500 && error.requestId) {
    return `We could not complete the deletion right now. Please try again later. Reference: ${error.requestId}`
  }

  if (error instanceof ApiClientError && error.status >= 500) {
    return 'We could not complete the deletion right now. Please try again later.'
  }

  if (error instanceof ApiClientError && error.status === 401) {
    return 'Your session has expired. Please sign in again and retry.'
  }

  if (error instanceof ApiClientError && error.status === 403) {
    return 'You do not have permission to delete this account.'
  }

  return 'We could not complete the deletion. Please try again.'
}

interface SettingsProfilePayload {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  autoAdjustAccountDate?: boolean
  breakEvenThreshold?: number
  pnlDisplayMode?: string
  aiSettings?: Partial<typeof defaultAiSettings>
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const { theme, accentPack, widgetStyle, chartStyle } = useTheme()
  const {
    handleThemeChange,
    handleWidgetStyleChange,
    handleAccentChange,
    handleChartStyleChange,
  } = useSettingsPreferences()
  const storeUser = useUserStore(state => state.supabaseUser)
  const dbUser = useUserStore(state => state.user)
  const setDbUser = useUserStore(state => state.setUser)
  const { user: authUser, logout, logoutAfterDeletion, logoutAll } = useAuth()
  const user = storeUser ?? authUser
  const timezone = useUserStore(state => state.timezone)
  const setTimezone = useUserStore(state => state.setTimezone)
  const use24HourFormat = useUserStore(state => state.use24HourFormat)
  const setUse24HourFormat = useUserStore(state => state.setUse24HourFormat)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false)
  const [isSignOutAllDialogOpen, setIsSignOutAllDialogOpen] = useState(false)

  const [profileData, setProfileData] = useState<SettingsProfileData>({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    autoAdjustAccountDate: false,
    breakEvenThreshold: 10,
    pnlDisplayMode: 'net',
    aiSettings: defaultAiSettings,
  })
  const [breakEvenDraft, setBreakEvenDraft] = useState('10')
  const [isUpdatingBreakEven, setIsUpdatingBreakEven] = useState(false)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isUpdatingAiSettings, setIsUpdatingAiSettings] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [savedProfileNames, setSavedProfileNames] = useState({
    firstName: '',
    lastName: '',
  })
  const avatarUrl = getUserAvatarUrl(storeUser, authUser)

  const [privacyMode, setPrivacyMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('privacyMode') === 'true'
    }
    return false
  })

  const handlePrivacyModeToggle = (checked: boolean) => {
    setPrivacyMode(checked)
    localStorage.setItem('privacyMode', String(checked))
    toast.success(checked ? 'Privacy mode enabled' : 'Privacy mode disabled', {
      description: checked ? 'Monetary values will be hidden across the app.' : 'Monetary values are visible.',
      duration: 2000
    })
  }

  const [subscriptionData, setSubscriptionData] = useState<SettingsSubscriptionData | null>(null)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true)
  const [isCancelingSubscription, setIsCancelingSubscription] = useState(false)

  const [webhookToken, setWebhookToken] = useState<string | null>(null)
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false)
  const [isRegeneratingWebhook, setIsRegeneratingWebhook] = useState(false)
  const [isRegenerateWebhookDialogOpen, setIsRegenerateWebhookDialogOpen] = useState(false)
  const [webhookCopied, setWebhookCopied] = useState(false)

  useEffect(() => {
    const fetchWebhookToken = async () => {
      try {
        setIsLoadingWebhook(true)
        const response = await apiRequest<{ hasToken: boolean; token: string | null }>(
          '/api/v1/auth/webhook-token',
          { retry: { mode: 'safe' }, operation: 'load-webhook-token' },
        )
        if (response.data?.token) setWebhookToken(response.data.token)
      } catch (error) {
        reportError(error, {
          surface: 'client',
          operation: 'load-webhook-token',
          route: '/dashboard/settings',
        })
      } finally {
        setIsLoadingWebhook(false)
      }
    }
    fetchWebhookToken()
  }, [])

  const handleCancelSubscription = async () => {
    setIsCancelingSubscription(true)
    try {
      const response = await apiRequest<{ cancelAtPeriodEnd: boolean; currentPeriodEnd?: string | null }>(
        '/api/v1/billing/cancel',
        { method: 'POST', retry: { mode: 'never' }, operation: 'cancel-whop-subscription' },
      )

      setSubscriptionData((current) => {
        if (!current) return current
        const nextPeriodEnd = response.data?.currentPeriodEnd ?? current.currentPeriodEnd
        return {
          ...current,
          cancelAtPeriodEnd: true,
          ...(nextPeriodEnd !== undefined ? { currentPeriodEnd: nextPeriodEnd } : {}),
        }
      })
      toast.success('Subscription cancellation scheduled', {
        description: 'Your access remains active until the end of the paid period.',
      })
    } catch (error) {
      reportSettingsMutationError(error, 'cancel-whop-subscription')
      toast.error('Cancellation failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsCancelingSubscription(false)
    }
  }

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setIsLoadingSubscription(true)
        const response = await apiRequest<SettingsSubscriptionData>(
          '/api/v1/billing/status',
          { retry: { mode: 'safe' }, operation: 'load-subscription' },
        )
        setSubscriptionData(response.data)
      } catch (error) {
        reportError(error, {
          surface: 'client',
          operation: 'load-subscription',
          route: '/dashboard/settings',
        })
        setSubscriptionData(null)
      } finally {
        setIsLoadingSubscription(false)
      }
    }

    fetchSubscription()
  }, [])

  const regenerateWebhookToken = async () => {
    try {
      setIsRegeneratingWebhook(true)
      const response = await apiRequest<{ token: string }>(
        '/api/v1/auth/webhook-token',
        { method: 'POST', retry: { mode: 'never' }, operation: 'regenerate-webhook-token' },
      )
      if (typeof response.data?.token !== 'string' || response.data.token.length === 0) {
        throw new Error('Failed to regenerate token')
      }

      setWebhookToken(response.data.token)
      setWebhookCopied(false)
      toast.success('Token regenerated', {
        description: 'Your TradingView webhook token has been regenerated. Update your TradingView alert.',
        duration: 4000,
      })
    } catch (error) {
      reportSettingsMutationError(error, 'regenerate-webhook-token')
      toast.error('Failed to regenerate token')
    } finally {
      setIsRegeneratingWebhook(false)
    }
  }

  const copyWebhookUrl = async () => {
    if (!webhookToken) return
    try {
      const url = `${window.location.origin}/api/v1/import/webhook/tradingview?token=${webhookToken}`
      await navigator.clipboard.writeText(url)
      setWebhookCopied(true)
      setTimeout(() => setWebhookCopied(false), 2500)
    } catch (error) {
      reportSettingsMutationError(error, 'copy-webhook-url')
      toast.error('Could not copy webhook URL')
    }
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoadingProfile(true)
        const response = await apiRequest<SettingsProfilePayload>(
          '/api/auth/profile',
          { retry: { mode: 'safe' }, operation: 'load-profile' },
        )
        const result = response.data
        if (!result) throw new Error('Failed to load profile')

        const nextFirstName = result.firstName || ''
        const nextLastName = result.lastName || ''
        setProfileData({
          firstName: nextFirstName,
          lastName: nextLastName,
          email: result.email || '',
          autoAdjustAccountDate: result.autoAdjustAccountDate ?? false,
          breakEvenThreshold: typeof result.breakEvenThreshold === 'number' ? result.breakEvenThreshold : 10,
          pnlDisplayMode: normalizePnlDisplayMode(result.pnlDisplayMode),
          aiSettings: {
            ...defaultAiSettings,
            ...(result.aiSettings || {})
          }
        })
        setSavedProfileNames({
          firstName: nextFirstName,
          lastName: nextLastName,
        })
        const safeThreshold = typeof result.breakEvenThreshold === 'number' ? result.breakEvenThreshold : 10
        setBreakEvenDraft(String(safeThreshold))
      } catch (error) {
        reportError(error, {
          surface: 'client',
          operation: 'load-profile',
          route: '/dashboard/settings',
        })
        toast.error('Could not load your profile settings')
      } finally {
        setIsLoadingProfile(false)
      }
    }

    fetchProfile()
  }, [])

  const handleProfileUpdate = async () => {
    setIsUpdatingProfile(true)
    try {
      await apiRequest<SettingsProfilePayload>('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          autoAdjustAccountDate: profileData.autoAdjustAccountDate
        }),
        retry: { mode: 'never' },
        operation: 'update-profile',
      })

      setSavedProfileNames({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
      })
      setIsEditingProfile(false)
      toast.success("Profile updated", {
        description: "Your profile information has been saved.",
        duration: 3000
      })
    } catch (error) {
      reportSettingsMutationError(error, 'update-profile')
      toast.error("Update failed", {
        description: error instanceof Error ? error.message : "There was an error updating your profile.",
        duration: 3000
      })
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleTimezoneChange = async (value: string) => {
    const previous = timezone
    setTimezone(value)
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: value }),
        retry: { mode: 'never' },
        operation: 'update-timezone',
      })
      toast.success("Timezone updated", {
        description: `Timezone changed to ${value.replace('_', ' ')}.`,
        duration: 2000
      })
    } catch (error) {
      reportSettingsMutationError(error, 'update-timezone')
      setTimezone(previous)
      toast.error("Failed to sync timezone")
    }
  }

  const handleAutoAdjustChange = async (checked: boolean) => {
    const previous = profileData.autoAdjustAccountDate
    setProfileData(prev => ({ ...prev, autoAdjustAccountDate: checked }))

    try {
      const response = await apiRequest<SettingsProfilePayload>('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoAdjustAccountDate: checked }),
        retry: { mode: 'never' },
        operation: 'update-auto-adjust-account-date',
      })

      setProfileData(prev => ({
        ...prev,
        autoAdjustAccountDate: response.data?.autoAdjustAccountDate ?? checked
      }))
    } catch (error) {
      reportSettingsMutationError(error, 'update-auto-adjust-account-date')
      setProfileData(prev => ({ ...prev, autoAdjustAccountDate: previous }))
      toast.error('Auto-adjust update failed', {
        description: error instanceof Error ? error.message : 'Failed to save Auto-adjust Account Date preference.',
        duration: 3000
      })
    }
  }

  const handleBreakEvenThresholdSave = async () => {
    const parsed = Number.parseFloat(breakEvenDraft)
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Invalid threshold', {
        description: 'Break-even threshold must be a non-negative number.',
        duration: 3000
      })
      return
    }

    const normalized = Math.abs(parsed)
    const previous = profileData.breakEvenThreshold
    setIsUpdatingBreakEven(true)

    try {
      const response = await apiRequest<SettingsProfilePayload>('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breakEvenThreshold: normalized }),
        retry: { mode: 'never' },
        operation: 'update-break-even-threshold',
      })

      const next = typeof response.data?.breakEvenThreshold === 'number'
        ? response.data.breakEvenThreshold
        : normalized

      setProfileData(prev => ({ ...prev, breakEvenThreshold: next }))
      setBreakEvenDraft(String(next))
      toast.success('Break-even threshold updated', {
        description: `Current band: ${formatBreakevenBand(next)}`,
        duration: 2500
      })
    } catch (error) {
      reportSettingsMutationError(error, 'update-break-even-threshold')
      setProfileData(prev => ({ ...prev, breakEvenThreshold: previous }))
      setBreakEvenDraft(String(previous))
      toast.error('Break-even update failed', {
        description: error instanceof Error ? error.message : 'Failed to save break-even threshold.',
        duration: 3000
      })
    } finally {
      setIsUpdatingBreakEven(false)
    }
  }

  const handlePnlDisplayModeChange = async (value: string) => {
    const nextMode = normalizePnlDisplayMode(value)
    const previous = profileData.pnlDisplayMode

    setProfileData(prev => ({ ...prev, pnlDisplayMode: nextMode }))

    try {
      const response = await apiRequest<SettingsProfilePayload>('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pnlDisplayMode: nextMode }),
        retry: { mode: 'never' },
        operation: 'update-pnl-display-mode',
      })

      setProfileData(prev => ({
          ...prev,
          pnlDisplayMode: normalizePnlDisplayMode(response.data?.pnlDisplayMode)
        }))
        if (dbUser) {
          setDbUser({
            ...dbUser,
            pnlDisplayMode: normalizePnlDisplayMode(response.data?.pnlDisplayMode)
          } as typeof dbUser)
        }

        toast.success('P&L display updated', {
          description: nextMode === 'gross'
            ? 'Dashboard and report monetary values now prefer gross P&L before fees.'
          : 'Dashboard and report monetary values now prefer net P&L after fees.',
        duration: 2500
      })
    } catch (error) {
      reportSettingsMutationError(error, 'update-pnl-display-mode')
      setProfileData(prev => ({ ...prev, pnlDisplayMode: previous }))
      toast.error('P&L display update failed', {
        description: error instanceof Error ? error.message : 'Failed to save P&L display preference.',
        duration: 3000
      })
    }
  }

  const handleAiSettingsChange = async (
    key: keyof typeof defaultAiSettings,
    checked: boolean
  ) => {
    const previous = profileData.aiSettings
    const next = { ...previous, [key]: checked }

    setProfileData(prev => ({ ...prev, aiSettings: next }))
    setIsUpdatingAiSettings(true)

    try {
      await apiRequest<SettingsProfilePayload>('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiSettings: { [key]: checked } }),
        retry: { mode: 'never' },
        operation: 'update-ai-settings',
      })

      toast.success('AI preferences updated', {
        description: 'Your AI settings were saved successfully.',
        duration: 2500
      })
    } catch (error) {
      reportSettingsMutationError(error, 'update-ai-settings')
      setProfileData(prev => ({ ...prev, aiSettings: previous }))
      toast.error('AI settings update failed', {
        description: error instanceof Error ? error.message : 'Failed to save AI settings.',
        duration: 3000
      })
    } finally {
      setIsUpdatingAiSettings(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'Delete my account') {
      toast.error("Confirmation required", {
        description: "Please type 'Delete my account' to confirm.",
        duration: 3000
      })
      return
    }

    setIsDeleting(true)
    try {
      await apiRequest('/api/v1/user/delete', {
        method: 'DELETE',
      })

      toast.success("Account deleted", {
        description: "Your account and all data have been permanently deleted.",
        duration: 3000
      })

      setIsDeleteModalOpen(false)
      setDeleteConfirmText('')
      await logoutAfterDeletion()

    } catch (error) {
      reportSettingsMutationError(error, 'delete-account')
      toast.error("Deletion failed", {
        description: getDeleteAccountErrorDescription(error),
        duration: 5000
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const isDeleteConfirmed = deleteConfirmText === 'Delete my account'

  const handleCancelProfileEdit = () => {
    setProfileData(prev => ({
      ...prev,
      firstName: savedProfileNames.firstName,
      lastName: savedProfileNames.lastName,
    }))
    setIsEditingProfile(false)
  }

  const [activeTab, setActiveTab] = useState<SettingsSectionId>('profile')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'help') setActiveTab('help')
  }, [searchParams])

  const categories = [
    { id: 'profile' as const, label: 'Profile & Plan', icon: User02Icon },
    { id: 'preferences' as const, label: 'Preferences', icon: Setting06Icon },
    { id: 'integrations' as const, label: 'Integrations', icon: WebhookIcon },
    { id: 'connections' as const, label: 'Connections', icon: Link02Icon },
    { id: 'security' as const, label: 'Security & Data', icon: Shield01Icon },
    { id: 'help' as const, label: 'Help', icon: BookMarkedIcon },
  ]

  const { startTour } = useTour()

  return (
    <SettingsShell>
      {            }
      <SettingsHeader>
        <PageHeader title="Settings" className="gap-2" />
      </SettingsHeader>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        <SettingsNavigation categories={categories} value={activeTab} onValueChange={setActiveTab} />

        {                       }
        <div className="flex-1 min-w-0 w-full">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-8"
          >
            {activeTab === 'profile' && (
              <SettingsProfileSection
                user={user}
                avatarUrl={avatarUrl}
                profileData={profileData}
                setProfileData={setProfileData}
                isEditingProfile={isEditingProfile}
                setIsEditingProfile={setIsEditingProfile}
                isLoadingProfile={isLoadingProfile}
                isUpdatingProfile={isUpdatingProfile}
                onCancelEdit={handleCancelProfileEdit}
                onSave={handleProfileUpdate}
                subscriptionData={subscriptionData}
                isLoadingSubscription={isLoadingSubscription}
                isCancelingSubscription={isCancelingSubscription}
                onCancelSubscription={handleCancelSubscription}
              />
            )}
            {activeTab === 'preferences' && (
              <SettingsPreferencesSection
                theme={theme}
                accentPack={accentPack}
                widgetStyle={widgetStyle}
                chartStyle={chartStyle}
                onThemeChange={handleThemeChange}
                onAccentChange={handleAccentChange}
                onWidgetStyleChange={handleWidgetStyleChange}
                onChartStyleChange={handleChartStyleChange}
                timezone={timezone}
                onTimezoneChange={handleTimezoneChange}
                use24HourFormat={use24HourFormat}
                setUse24HourFormat={setUse24HourFormat}
                profileData={profileData}
                breakEvenDraft={breakEvenDraft}
                setBreakEvenDraft={setBreakEvenDraft}
                isUpdatingBreakEven={isUpdatingBreakEven}
                onBreakEvenSave={handleBreakEvenThresholdSave}
                onPnlDisplayModeChange={handlePnlDisplayModeChange}
                privacyMode={privacyMode}
                onPrivacyModeToggle={handlePrivacyModeToggle}
                onAutoAdjustChange={handleAutoAdjustChange}
                isLoadingProfile={isLoadingProfile}
                isUpdatingAiSettings={isUpdatingAiSettings}
                onAiSettingsChange={handleAiSettingsChange}
              />
            )}
            {activeTab === 'integrations' && <SettingsIntegrations token={webhookToken} loading={isLoadingWebhook} copied={webhookCopied} regenerating={isRegeneratingWebhook} onCopyUrl={copyWebhookUrl} onRegenerate={() => setIsRegenerateWebhookDialogOpen(true)} />}
            {activeTab === 'connections' && <SettingsConnections />}
            {activeTab === 'security' && <SettingsSecurity editingProfile={isEditingProfile} onSignOutPrompt={() => { if (isEditingProfile) setIsSignOutDialogOpen(true); else { void logout() } }} onSignOutAll={() => setIsSignOutAllDialogOpen(true)} onDelete={() => setIsDeleteModalOpen(true)} />}
            {activeTab === 'help' && <SettingsHelpSection startTour={startTour} />}
          </motion.div>
        </div>
      </div>

      <SettingsDialogs
        deleteOpen={isDeleteModalOpen}
        onDeleteOpenChange={setIsDeleteModalOpen}
        deleteConfirmText={deleteConfirmText}
        onDeleteConfirmTextChange={setDeleteConfirmText}
        deleting={isDeleting}
        deleteConfirmed={isDeleteConfirmed}
        onDeleteAccount={handleDeleteAccount}
        regenerateOpen={isRegenerateWebhookDialogOpen}
        onRegenerateOpenChange={setIsRegenerateWebhookDialogOpen}
        regenerating={isRegeneratingWebhook}
        onRegenerateToken={regenerateWebhookToken}
        signOutOpen={isSignOutDialogOpen}
        onSignOutOpenChange={setIsSignOutDialogOpen}
        onSignOut={() => {
          void logout()
        }}
        signOutAllOpen={isSignOutAllDialogOpen}
        onSignOutAllOpenChange={setIsSignOutAllDialogOpen}
        onSignOutAll={() => {
          void logoutAll()
        }}
      />
    </SettingsShell>
  )
}
