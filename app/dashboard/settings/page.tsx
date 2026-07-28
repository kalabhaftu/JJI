'use client'

import { LinkedAccounts } from "@/components/linked-accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useTheme } from '@/context/theme-provider'
import { useAuth } from '@/context/auth-provider'
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { formatBreakevenBand } from '@/lib/metrics/outcome'
import { normalizePnlDisplayMode, type PnlDisplayMode } from '@/lib/metrics/pnl'
import { signOut } from "@/server/auth"
import { useUserStore } from '@/store/user-store'
import {
  ChevronRight as CaretRight,
  ChevronDown,
  Check,
  Clock,
  Copy,
  CreditCard,
  Database,
  Pencil,
  Laptop,
  Moon,
  Palette,
  RefreshCw,
  Settings as SettingsIcon,
  Bot,
  Shield,
  LogOut as SignOut,
  Sparkles,
  BellRing,
  Sun,
  Trash2 as Trash,
  User,
  AlertCircle as WarningCircle,
  Calendar,
  Target,
  LayoutGrid,
  Zap,
  Globe,
  SunMoon,
  TrendingUp,
  Activity,
  Webhook,
  Link2 as LinkIcon,
  BookMarked,
  Eye,
} from "lucide-react"
import { motion } from "framer-motion"
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from "sonner"
import { CacheManagement } from "./components/cache-management"
import { SettingRow } from './components/setting-row'
import { buildTradingViewWebhookExample, defaultAiSettings, timezones } from './components/settings-config'
import { PageHeader } from "@/components/ui/page-header"
import { getUserAvatarUrl } from "@/lib/user-avatar"
import { useTour } from '@/context/tour-context'

export default function SettingsPage() {
  const { theme, setTheme, accentPack, setAccentPack, widgetStyle, setWidgetStyle, chartStyle, setChartStyle } = useTheme()
  const storeUser = useUserStore(state => state.supabaseUser)
  const dbUser = useUserStore(state => state.user)
  const setDbUser = useUserStore(state => state.setUser)
  const { user: authUser } = useAuth()
  const user = storeUser ?? authUser
  const timezone = useUserStore(state => state.timezone)
  const setTimezone = useUserStore(state => state.setTimezone)
  const use24HourFormat = useUserStore(state => state.use24HourFormat)
  const setUse24HourFormat = useUserStore(state => state.setUse24HourFormat)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    autoAdjustAccountDate: false,
    breakEvenThreshold: 10,
    pnlDisplayMode: 'net' as PnlDisplayMode,
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
  const avatarUrl = getUserAvatarUrl(user)

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

  const [subscriptionData, setSubscriptionData] = useState<{
    hasAccess: boolean
    status: string
    reason?: string
    currentPeriodEnd?: string
    nextPaymentDue?: string
  } | null>(null)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true)

  const [webhookToken, setWebhookToken] = useState<string | null>(null)
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false)
  const [isRegeneratingWebhook, setIsRegeneratingWebhook] = useState(false)
  const [webhookCopied, setWebhookCopied] = useState(false)

  const handleThemeChange = (value: string) => {
    setTheme(value as "light" | "dark" | "system")
    toast.success("Theme updated", {
      description: `Theme changed to ${value === 'system' ? 'system default' : value} mode.`,
      duration: 2000
    })
  }

  const handleWidgetStyleChange = (value: 'default' | 'glass') => {
    setWidgetStyle(value)
    toast.success("Widget style updated", {
      description: `Widget style changed to ${value === 'glass' ? 'Glassmorphism' : 'Standard'}.`,
      duration: 2000
    })
  }

  const handleAccentChange = (value: 'classic' | 'reports' | 'violet' | 'slate') => {
    setAccentPack(value)
    toast.success("Color accent updated", {
      description: `Accent changed to ${value === 'reports' ? 'Forest' : value === 'violet' ? 'Orchid' : value === 'slate' ? 'Graphite' : 'Classic'}.`,
      duration: 2000
    })
  }

  const handleChartStyleChange = (value: 'smooth' | 'sharp') => {
    setChartStyle(value)
    toast.success("Chart style updated", {
      description: value === 'sharp' ? 'Charts now use sharp angular lines.' : 'Charts now use smooth curved lines.',
      duration: 2000
    })
  }

  useEffect(() => {
    const fetchWebhookToken = async () => {
      try {
        setIsLoadingWebhook(true)
        const res = await fetch('/api/v1/auth/webhook-token')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to fetch webhook token')
        if (data.token) setWebhookToken(data.token)
      } catch (error) {
        Sentry.captureException(error, { tags: { surface: 'settings', operation: 'load-webhook-token' } })
      } finally {
        setIsLoadingWebhook(false)
      }
    }
    fetchWebhookToken()
  }, [])

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setIsLoadingSubscription(true)
        const res = await fetch('/api/v1/subscription/status')
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load subscription status')
        setSubscriptionData(data.data)
      } catch (error) {
        Sentry.captureException(error, { tags: { surface: 'settings', operation: 'load-subscription' } })
        setSubscriptionData(null)
      } finally {
        setIsLoadingSubscription(false)
      }
    }

    const handleWindowFocus = () => {
      fetchSubscription()
    }

    fetchSubscription()
    window.addEventListener('focus', handleWindowFocus)

    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [])

  const regenerateWebhookToken = async () => {
    try {
      setIsRegeneratingWebhook(true)
      const res = await fetch('/api/v1/auth/webhook-token', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || typeof data.token !== 'string' || data.token.length === 0) {
        throw new Error(data.error || 'Failed to regenerate token')
      }

      setWebhookToken(data.token)
      setWebhookCopied(false)
      toast.success('Token regenerated', {
        description: 'Your TradingView webhook token has been regenerated. Update your TradingView alert.',
        duration: 4000,
      })
    } catch {
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
    } catch {
      toast.error('Could not copy webhook URL')
    }
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoadingProfile(true)
        const response = await fetch('/api/auth/profile')
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to load profile')
        }

        const nextFirstName = result.data.firstName || ''
        const nextLastName = result.data.lastName || ''
        setProfileData({
          firstName: nextFirstName,
          lastName: nextLastName,
          email: result.data.email || '',
          autoAdjustAccountDate: result.data.autoAdjustAccountDate ?? false,
          breakEvenThreshold: typeof result.data.breakEvenThreshold === 'number' ? result.data.breakEvenThreshold : 10,
          pnlDisplayMode: normalizePnlDisplayMode(result.data.pnlDisplayMode),
          aiSettings: {
            ...defaultAiSettings,
            ...(result.data.aiSettings || {})
          }
        })
        setSavedProfileNames({
          firstName: nextFirstName,
          lastName: nextLastName,
        })
        const safeThreshold = typeof result.data.breakEvenThreshold === 'number' ? result.data.breakEvenThreshold : 10
        setBreakEvenDraft(String(safeThreshold))
      } catch (error) {
        Sentry.captureException(error, { tags: { surface: 'settings', operation: 'load-profile' } })
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
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          autoAdjustAccountDate: profileData.autoAdjustAccountDate
        })
      })

      const result = await response.json()

        if (result.success) {
        setSavedProfileNames({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
        })
        setIsEditingProfile(false)
        toast.success("Profile updated", {
          description: "Your profile information has been saved.",
          duration: 3000
        })
      } else {
        throw new Error(result.error || 'Update failed')
      }
    } catch (error) {
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
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: value }),
      })
      if (!response.ok) throw new Error('Failed to save timezone')
      toast.success("Timezone updated", {
        description: `Timezone changed to ${value.replace('_', ' ')}.`,
        duration: 2000
      })
    } catch {
      setTimezone(previous)
      toast.error("Failed to sync timezone")
    }
  }

  const handleAutoAdjustChange = async (checked: boolean) => {
    const previous = profileData.autoAdjustAccountDate
    setProfileData(prev => ({ ...prev, autoAdjustAccountDate: checked }))

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoAdjustAccountDate: checked })
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save Auto-adjust Account Date preference')
      }

      setProfileData(prev => ({
        ...prev,
        autoAdjustAccountDate: result.data?.autoAdjustAccountDate ?? checked
      }))
    } catch (error) {
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
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breakEvenThreshold: normalized })
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update break-even threshold')
      }

      const next = typeof result.data?.breakEvenThreshold === 'number'
        ? result.data.breakEvenThreshold
        : normalized

      setProfileData(prev => ({ ...prev, breakEvenThreshold: next }))
      setBreakEvenDraft(String(next))
      toast.success('Break-even threshold updated', {
        description: `Current band: ${formatBreakevenBand(next)}`,
        duration: 2500
      })
    } catch (error) {
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
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pnlDisplayMode: nextMode })
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update P&L display mode')
      }

        setProfileData(prev => ({
          ...prev,
          pnlDisplayMode: normalizePnlDisplayMode(result.data?.pnlDisplayMode)
        }))
        if (dbUser) {
          setDbUser({
            ...dbUser,
            pnlDisplayMode: normalizePnlDisplayMode(result.data?.pnlDisplayMode)
          } as typeof dbUser)
        }

        toast.success('P&L display updated', {
          description: nextMode === 'gross'
            ? 'Dashboard and report monetary values now prefer gross P&L before fees.'
          : 'Dashboard and report monetary values now prefer net P&L after fees.',
        duration: 2500
      })
    } catch (error) {
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
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiSettings: { [key]: checked } })
      })
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update AI preferences')
      }

      toast.success('AI preferences updated', {
        description: 'Your AI settings were saved successfully.',
        duration: 2500
      })
    } catch (error) {
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
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete account')
      }

      toast.success("Account deleted", {
        description: "Your account and all data have been permanently deleted.",
        duration: 3000
      })

      const supabase = createClient()
      await supabase.auth.signOut()
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/?deleted=true'

    } catch (error) {
      toast.error("Deletion failed", {
        description: error instanceof Error ? error.message : "There was an error deleting your account.",
        duration: 5000
      })
    } finally {
      setIsDeleting(false)
      setIsDeleteModalOpen(false)
      setDeleteConfirmText("")
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

  const getThemeDisplay = () => {
    if (theme === 'dark') return { icon: Moon, label: 'Dark' }
    if (theme === 'light') return { icon: Sun, label: 'Light' }
    return { icon: Laptop, label: 'System' }
  }

  const themeInfo = getThemeDisplay()

  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'integrations' | 'connections' | 'security' | 'help'>('profile')

  const categories = [
    { id: 'profile' as const, label: 'Profile & Plan', icon: User },
    { id: 'preferences' as const, label: 'Preferences', icon: SettingsIcon },
    { id: 'connections' as const, label: 'Connections', icon: LinkIcon },
    { id: 'security' as const, label: 'Security & Data', icon: Shield },
    { id: 'help' as const, label: 'Help', icon: BookMarked },
  ]

  const { startTour } = useTour()

  const renderHelpTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-heading-text">Help</h2>
          <p className="text-xs text-muted-foreground/85">Restart interactive system tours to learn more about the platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/40 bg-card/45 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Core Onboarding Tour
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Take a quick walkthrough of the core platform layout, configure your timezone/theme in settings, and log a sample trade.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => startTour('onboarding')}
            >
              Start Onboarding Tour
            </Button>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/45 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                Trading Dashboard Tour
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Learn how to filter your data by specific trading accounts, customize and resize widgets on the dashboard canvas.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => startTour('dashboard')}
            >
              Start Dashboard Tour
            </Button>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/45 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Performance Analytics Tour
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Explore the reports view, analyze win-rates, profit factor metrics, trade duration stats, and weekly journal calendars.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => startTour('analytics')}
            >
              Start Analytics Tour
            </Button>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/45 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
                <SettingsIcon className="h-4 w-4 text-primary" />
                Settings & Customization Tour
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Understand how to modify preferences, toggle light/dark modes, add API credentials, and sync broker accounts.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => startTour('settings')}
            >
              Start Settings Tour
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const renderProfileTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-heading-text">Profile & Plan</h2>
          <p className="text-xs text-muted-foreground/85">Manage your personal information and subscription plan</p>
        </div>

        {/* Profile Card */}
        <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-6" data-tour="settings-card-profile">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Info
            </h3>
            <Button
              variant={isEditingProfile ? "secondary" : "outline"}
              size="sm"
              className="gap-2 h-8"
              onClick={() => setIsEditingProfile(true)}
              disabled={isLoadingProfile || isEditingProfile}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          </div>

          {/* User Info details */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/20 border border-border/10">
            <Avatar className="h-12 w-12 shrink-0 border border-border/25">
              <AvatarImage key={avatarUrl ?? 'settings-avatar-fallback'} src={avatarUrl} referrerPolicy="no-referrer" />
              <AvatarFallback className="text-lg">
                {user?.email?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate text-heading-text">{user?.email}</p>
              <p className="text-xs text-muted-foreground">
                Member since {new Date(user?.created_at || '').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 bg-muted text-muted-foreground border-border/25 text-xs font-normal">Active</Badge>
          </div>

          {isLoadingProfile ? (
            <div className="space-y-4">
              <div className="space-y-1.5"><Skeleton className="h-3 w-16" /><Skeleton className="h-9 w-full" /></div>
              <div className="space-y-1.5"><Skeleton className="h-3 w-16" /><Skeleton className="h-9 w-full" /></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs text-muted-foreground">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Enter your first name"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                  disabled={isLoadingProfile || !isEditingProfile}
                  className="h-9 bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-xs text-muted-foreground">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Enter your last name"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                  disabled={isLoadingProfile || !isEditingProfile}
                  className="h-9 bg-background/50"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
            <Input id="email" type="email" value={user?.email || ''} disabled className="h-9 bg-background/25 border-border/20 text-muted-foreground" />
          </div>

          {isEditingProfile && (
            <div className="flex flex-col gap-2 sm:flex-row pt-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-9 text-xs"
                onClick={handleCancelProfileEdit}
                disabled={isUpdatingProfile}
              >
                Cancel
              </Button>
              <Button
                onClick={handleProfileUpdate}
                loading={isUpdatingProfile || isLoadingProfile}
                loadingText={isLoadingProfile ? "Fetching..." : "Updating..."}
                className="w-full sm:w-auto h-9 text-xs"
              >
                Save Profile
              </Button>
            </div>
          )}
        </div>

        {/* Subscription Plan details */}
        <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription Plan
          </h3>

          {isLoadingSubscription ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : subscriptionData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/10">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-semibold text-heading-text mt-0.5">
                      {subscriptionData.reason || subscriptionData.status}
                    </p>
                  </div>
                  <Badge variant={subscriptionData.hasAccess ? 'secondary' : 'destructive'} className="shrink-0">
                    {subscriptionData.hasAccess ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {subscriptionData.currentPeriodEnd && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/10">
                    <div>
                      <p className="text-xs text-muted-foreground">Period Ends</p>
                      <p className="text-sm font-semibold text-heading-text mt-0.5">
                        {new Date(subscriptionData.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {(() => {
                        const days = Math.ceil((new Date(subscriptionData.currentPeriodEnd!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        return days > 0 ? `${days} day${days !== 1 ? 's' : ''} left` : 'Expired'
                      })()}
                    </span>
                  </div>
                )}
              </div>

              {subscriptionData.nextPaymentDue && (
                <div className="p-4 rounded-lg bg-muted/20 border border-border/10 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Next Payment Due</p>
                    <p className="text-sm font-semibold text-heading-text mt-0.5">
                      {new Date(subscriptionData.nextPaymentDue).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}

              {!subscriptionData.hasAccess && (
                <Link href="/subscribe">
                  <Button size="sm" className="gap-2 w-full mt-2 h-9 text-xs">
                    <CreditCard className="h-3.5 w-3.5" />
                    Subscribe to Premium
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load subscription info</p>
          )}
        </div>
      </div>
    )
  }

  const renderPreferencesTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-heading-text">Preferences</h2>
          <p className="text-xs text-muted-foreground/85">Customize your platform experience and AI settings</p>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-1" data-tour="settings-card-preferences">
          {/* Theme selection */}
          <SettingRow
            icon={SunMoon}
            label="Theme"
            description="Choose your preferred color scheme"
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 min-w-[110px] h-8 text-xs" data-tour="theme-switcher-container">
                    <themeInfo.icon className="h-3.5 w-3.5" />
                    {themeInfo.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleThemeChange("dark")}>
                    <Moon className="mr-2 h-3.5 w-3.5" />
                    Dark
                    {theme === 'dark' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleThemeChange("light")}>
                    <Sun className="mr-2 h-3.5 w-3.5" />
                    Light
                    {theme === 'light' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleThemeChange("system")}>
                    <Laptop className="mr-2 h-3.5 w-3.5" />
                    System
                    {theme === 'system' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {/* Color Accent selection */}
          <SettingRow
            icon={Palette}
            label="Color Accent"
            description={accentPack === 'reports' ? 'Forest' : accentPack === 'violet' ? 'Orchid' : accentPack === 'slate' ? 'Graphite' : 'Classic'}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 min-w-[155px] h-8 text-xs justify-between">
                    <span className="flex items-center gap-2">
                      <span className="flex gap-1 shrink-0">
                        <span className={cn("w-2 h-2 rounded-full",
                          accentPack === 'reports' ? 'bg-[#83b885]' : accentPack === 'violet' ? 'bg-[#a78bfa]' : accentPack === 'slate' ? 'bg-[#f8fafc]' : 'bg-[#10b981]'
                        )} />
                        <span className={cn("w-2 h-2 rounded-full",
                          accentPack === 'reports' ? 'bg-[#ce6730]' : accentPack === 'violet' ? 'bg-[#f472b6]' : accentPack === 'slate' ? 'bg-[#64748b]' : 'bg-[#ef4444]'
                        )} />
                      </span>
                      {accentPack === 'reports' ? 'Forest' : accentPack === 'violet' ? 'Orchid' : accentPack === 'slate' ? 'Graphite' : 'Classic'}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAccentChange('classic')}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                        <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                      </div>
                      Classic
                    </div>
                    {accentPack === 'classic' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAccentChange('reports')}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-[#83b885]" />
                        <div className="w-3 h-3 rounded-full bg-[#ce6730]" />
                      </div>
                      Forest
                    </div>
                    {accentPack === 'reports' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAccentChange('violet')}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-[#a78bfa]" />
                        <div className="w-3 h-3 rounded-full bg-[#f472b6]" />
                      </div>
                      Orchid
                    </div>
                    {accentPack === 'violet' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAccentChange('slate')}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-[#f8fafc]" />
                        <div className="w-3 h-3 rounded-full bg-[#64748b]" />
                      </div>
                      Graphite
                    </div>
                    {accentPack === 'slate' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {/* Timezone selection */}
          <SettingRow
            icon={Globe}
            label="Timezone"
            description={timezone.replace('_', ' ')}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                    Change
                    <CaretRight className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <ScrollArea className="h-[200px]">
                    <DropdownMenuRadioGroup value={timezone} onValueChange={handleTimezoneChange}>
                      {timezones.map((tz) => (
                        <DropdownMenuRadioItem key={tz} value={tz} className="text-xs">
                          {tz.replace('_', ' ')}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {/* Time Format */}
          <SettingRow
            icon={Clock}
            label="Time Format"
            description={use24HourFormat ? "24-hour" : "12-hour"}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                    Change
                    <CaretRight className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup value={use24HourFormat ? "24h" : "12h"} onValueChange={(v) => {
                    setUse24HourFormat(v === "24h")
                    toast.success("Time format updated", {
                      description: `Time format changed to ${v === "24h" ? "24-hour" : "12-hour"}.`,
                      duration: 2000
                    })
                  }}>
                    <DropdownMenuRadioItem value="24h" className="text-xs">24-hour (14:30)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="12h" className="text-xs">12-hour (2:30 PM)</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {/* Break-even band */}
          <SettingRow
            icon={Target}
            label="Break-even threshold"
            description={`Breakeven band: ${formatBreakevenBand(profileData.breakEvenThreshold)}. Counted as win above +$${profileData.breakEvenThreshold}, loss below -$${profileData.breakEvenThreshold}.`}
            action={
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={breakEvenDraft}
                  onChange={(e) => setBreakEvenDraft(e.target.value)}
                  className="h-8 w-24 text-xs"
                />
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleBreakEvenThresholdSave}
                  disabled={isUpdatingBreakEven}
                >
                  {isUpdatingBreakEven ? 'Saving...' : 'Save'}
                </Button>
              </div>
            }
          />

          <Separator className="my-1 border-border/30" />

          {/* P&L display */}
          <SettingRow
            icon={TrendingUp}
            label="P&L display"
            description={profileData.pnlDisplayMode === 'gross'
              ? 'Show gross P&L before commissions and swap on dashboard/report money surfaces.'
              : 'Show net P&L after commissions and swap on dashboard/report money surfaces.'}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                    {profileData.pnlDisplayMode === 'gross' ? 'Gross' : 'Net'}
                    <CaretRight className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={profileData.pnlDisplayMode}
                    onValueChange={handlePnlDisplayModeChange}
                  >
                    <DropdownMenuRadioItem value="net" className="text-xs">Net (after fees)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="gross" className="text-xs">Gross (before fees)</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {/* Widget Style */}
          <SettingRow
            icon={LayoutGrid}
            label="Widget Style"
            description={widgetStyle === 'glass' ? 'Glassmorphism with distinct borders' : 'Standard muted panel style'}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 min-w-[120px] h-8 text-xs">
                    {widgetStyle === 'glass' ? 'Glassmorphism' : 'Standard'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleWidgetStyleChange('default')}>
                    Standard
                    {widgetStyle === 'default' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleWidgetStyleChange('glass')}>
                    Glassmorphism
                    {widgetStyle === 'glass' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {/* Chart Style */}
          <SettingRow
            icon={Activity}
            label="Chart Edge Style"
            description={chartStyle === 'sharp' ? 'Sharp angular lines following your color accent' : 'Smooth curved lines following your color accent'}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 min-w-[120px] h-8 text-xs">
                    {chartStyle === 'sharp' ? 'Sharp' : 'Smooth'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleChartStyleChange('smooth')}>
                    Smooth
                    {chartStyle === 'smooth' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleChartStyleChange('sharp')}>
                    Sharp
                    {chartStyle === 'sharp' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {/* Privacy Mode */}
          <SettingRow
            icon={Eye}
            label="Privacy Mode"
            description="Hide monetary balances across the dashboard"
            action={
              <Switch
                checked={privacyMode}
                onCheckedChange={handlePrivacyModeToggle}
              />
            }
          />

          <Separator className="my-1 border-border/30" />

          {/* Auto-adjust date */}
          <SettingRow
            icon={Calendar}
            label="Auto-adjust Account Date"
            description="Automatically set account start date to your first trade"
            action={
              <Button
                variant={profileData.autoAdjustAccountDate ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleAutoAdjustChange(!profileData.autoAdjustAccountDate)}
              >
                {profileData.autoAdjustAccountDate ? "Enabled" : "Disabled"}
              </Button>
            }
          />
        </div>

        {/* AI Preferences */}
        <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Preferences
          </h3>

          <div className="space-y-1">
            <SettingRow
              icon={Sparkles}
              label="Weekly AI Performance Reviews"
              description="Get an AI-generated weekly report card every weekend"
              action={
                <Switch
                  checked={profileData.aiSettings.autoGenerateInsights}
                  onCheckedChange={(checked) => handleAiSettingsChange('autoGenerateInsights', checked)}
                  disabled={isLoadingProfile || isUpdatingAiSettings}
                />
              }
            />

            <Separator className="my-1 border-border/30" />

            <SettingRow
              icon={BellRing}
              label="AI insights in notifications"
              description="Create a notification with a summary when you run an AI analysis"
              action={
                <Switch
                  checked={profileData.aiSettings.includeAiInsightsInNotifications}
                  onCheckedChange={(checked) => handleAiSettingsChange('includeAiInsightsInNotifications', checked)}
                  disabled={isLoadingProfile || isUpdatingAiSettings}
                />
              }
            />
          </div>
        </div>
      </div>
    )
  }

  const renderIntegrationsTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-heading-text">Integrations</h2>
          <p className="text-xs text-muted-foreground/85">Automate trade importing using third-party alerts and webhooks</p>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-6" data-tour="settings-card-integrations">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Webhook className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-heading-text">TradingView Webhook</h3>
              <p className="text-xs text-muted-foreground">Auto-import trades via TradingView alerts</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/85">
            Paste this URL into the TradingView alert webhook field. The secret token does not go in the URL; it goes inside the JSON message body shown below.
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 font-mono text-[11px] text-muted-foreground truncate">
              {isLoadingWebhook ? (
                <Skeleton className="h-3.5 w-full" />
              ) : webhookToken ? (
                `${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/import/webhook/tradingview?token=${webhookToken}`
              ) : (
                'Loading...'
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label={webhookCopied ? "Webhook URL copied" : "Copy webhook URL"}
              title={webhookCopied ? "Copied" : "Copy webhook URL"}
              className="shrink-0 h-9 w-9"
              disabled={!webhookToken || isLoadingWebhook}
              onClick={copyWebhookUrl}
            >
              {webhookCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-muted-foreground/60">
              Regenerating creates a new URL and invalidates the old one.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs shrink-0 h-8"
              disabled={isRegeneratingWebhook}
              onClick={regenerateWebhookToken}
            >
              <RefreshCw className={cn('h-3 w-3', isRegeneratingWebhook && 'animate-spin')} />
              Regenerate Token
            </Button>
          </div>

          <div className="space-y-2 rounded-xl border border-border/40 bg-muted/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold text-heading-text">TradingView alert message body</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs hover:bg-muted/50 font-medium"
                disabled={!webhookToken || isLoadingWebhook}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(buildTradingViewWebhookExample(webhookToken))
                    toast.success('Webhook example copied')
                  } catch (error) {
                    Sentry.captureException(error, { tags: { surface: 'settings', operation: 'copy-webhook-example' } })
                    toast.error('Could not copy webhook example')
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy JSON
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-border/30 bg-background/45 p-3 text-[11px] leading-5 text-muted-foreground/90 font-mono">
              {buildTradingViewWebhookExample(webhookToken)}
            </pre>
            <p className="text-[10px] text-muted-foreground/70 leading-4">
              Required fields: <code className="text-xs bg-muted px-1 py-0.5 rounded text-foreground font-mono">token</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded text-foreground font-mono">symbol</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded text-foreground font-mono">side</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded text-foreground font-mono">entry_price</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded text-foreground font-mono">close_price</code>. If quantity, pnl, or timestamps are missing, the import still succeeds but with reduced detail.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const renderConnectionsTab = () => {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-heading-text">Connections</h2>
          <p className="text-xs text-muted-foreground/85">Manage imports, webhooks, and sign-in providers</p>
        </div>

        {renderIntegrationsTab()}

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-heading-text">Linked accounts</h3>
            <p className="text-xs text-muted-foreground/85">Manage the providers that can sign you in.</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/45 p-6" data-tour="settings-card-connections">
            <LinkedAccounts plain={true} />
          </div>
        </div>
      </div>
    )
  }

  const renderSecurityTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-heading-text">Security & Data Management</h2>
          <p className="text-xs text-muted-foreground/85">Manage your local storage cache, export data, sign out, or delete your account</p>
        </div>

        {/* Cache Management */}
        <div className="rounded-xl border border-border/40 bg-card/45 p-6" data-tour="settings-card-security">
          <CacheManagement plain={true} />
        </div>

        {/* Account and Data controls */}
        <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Account Actions
          </h3>

          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/data">
              <Button variant="outline" className="gap-2 h-9 text-xs">
                <Database className="h-4 w-4" />
                Data Management
              </Button>
            </Link>

            <Button
              variant="outline"
              className="gap-2 h-9 text-xs"
              onClick={() => {
                localStorage.removeItem('jji_user_data')
                signOut()
              }}
            >
              <SignOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>

          <Separator className="border-border/30" />

          {/* Danger Zone */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider">Danger Zone</h4>
            <p className="text-xs text-muted-foreground/85 text-balance">
              Permanently delete your account and all associated trading data, files, and settings. This action is irreversible.
            </p>
            <Button
              variant="outline"
              className="gap-2 h-9 text-xs mt-1 border-destructive/30 hover:border-destructive hover:bg-destructive/10"
              onClick={() => setIsDeleteModalOpen(true)}
            >
              <Trash className="h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="mb-8">
        <PageHeader title="Settings" className="gap-2" />
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0 flex md:flex-col overflow-x-auto md:overflow-x-visible pb-3 md:pb-0 gap-1 border-b md:border-b-0 md:border-r border-border/40 pr-0 md:pr-4 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon
            const isActive = activeTab === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                data-tour={`settings-tab-${cat.id}`}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap md:w-full text-left shrink-0",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-muted/65 rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate">{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content Panel */}
        <div className="flex-1 min-w-0 w-full">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-8"
          >
             {activeTab === 'profile' && renderProfileTab()}
            {activeTab === 'preferences' && renderPreferencesTab()}
            {activeTab === 'connections' && renderConnectionsTab()}
            {activeTab === 'security' && renderSecurityTab()}
            {activeTab === 'help' && renderHelpTab()}
          </motion.div>
        </div>
      </div>

      {/* Delete Account Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <WarningCircle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-left space-y-3">
                <p className="text-sm">
                  This action is <strong>irreversible</strong> and will permanently delete:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Your account and profile</li>
                  <li>All trading data and history</li>
                  <li>Prop firm settings</li>
                  <li>Dashboard layouts and preferences</li>
                  <li>All uploaded files</li>
                </ul>
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <WarningCircle className="h-4 w-4" />
                    This data cannot be recovered.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Label htmlFor="delete-confirm" className="text-sm">
              Type <code className="bg-muted px-1 py-0.5 rounded text-xs">Delete my account</code> to confirm:
            </Label>
            <Input
              id="delete-confirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type here..."
              className="font-mono text-sm"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false)
                setDeleteConfirmText('')
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={!isDeleteConfirmed || isDeleting}
              loading={isDeleting}
              loadingText="Deleting..."
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  )
}
