'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from "@/context/auth-provider"
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'
import { useAccounts } from "@/hooks/use-accounts"
import { deleteAccountRequest, setAccountArchived } from '@/lib/accounts/api'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'
import { useData } from '@/context/data-provider'
import { useTradesStore } from '@/store/trades-store'
import { useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import { emitTourEvent } from '@/lib/tours/events'
import { useUserStore } from '@/store/user-store'
import { usePublicSurfaceRouting } from '@/hooks/use-public-surface-routing'
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RevealAction } from "@/components/ui/reveal-action"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Search01Icon,
  RefreshIcon,
  TrendingUpDownIcon,
  Building02Icon,
  User02Icon,
  Dollar01Icon,
  ActivityIcon,
  MoreHorizontalIcon,
  Alert02Icon,
  PencilEdit01Icon,
  Delete02Icon,
  ArchiveIcon,
  Rotate01Icon,
  Target01Icon,
  Award01Icon,
  CircleXIcon,
  Wallet01Icon,
  BarChartIcon,
  SparklesIcon,
  ChevronRightIcon,
  Cancel01Icon,
  Medal01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  EyeIcon
} from '@hugeicons/core-free-icons'
import { CreateLiveAccountDialog } from "../components/accounts/create-live-account-dialog"
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'
import { CreatePropFirmDialog } from "../components/prop-firm/create-prop-firm-dialog"
import { EditLiveAccountDialog } from "@/components/edit-live-account-dialog"
import { EditPropFirmAccountDialog } from "@/components/edit-prop-firm-account-dialog"
import { motion, AnimatePresence } from "framer-motion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { calculateAccountBalances } from "@/lib/utils/balance-calculator"
import { groupTradesByExecution } from '@/lib/trading/trade-grouping'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AccountsPageSkeleton } from "./components/accounts-page-skeleton"
import { PageHeader } from "@/components/ui/page-header"

interface Account {
  id: string
  name?: string
  number: string
  displayName?: string
  accountType: 'live' | 'prop-firm'
  broker?: string
  startingBalance?: number
  currentBalance?: number
  currentEquity?: number
  tradeCount?: number
  status?: 'active' | 'funded' | 'failed' | 'passed' | 'pending'
  currentPhase?: number
  phaseAccountNumber?: string | null
  profitTargetProgress?: number
  dailyDrawdownRemaining?: number
  maxDrawdownRemaining?: number
  totalPayouts?: number
  pnl?: number
  calculatedEquity?: number
  hasRecentBreach?: boolean
  createdAt?: string
  updatedAt?: string
  isArchived?: boolean
  currentPhaseDetails?: {
    phaseNumber: number
    status: string
    phaseId: string
    masterAccountId?: string
    evaluationType?: string
  } | null
}

function isFundedPhase(evaluationType: string | undefined, phaseNumber: number | undefined): boolean {
  return isFundedPhaseForEvaluation(evaluationType || '', phaseNumber || 0)
}

function isAccountFunded(account: Account): boolean {
  const evaluationType = account.currentPhaseDetails?.evaluationType
  const phaseNumber = account.currentPhase || account.currentPhaseDetails?.phaseNumber
  return isFundedPhase(evaluationType, phaseNumber)
}

function getStatusDisplayName(status?: string): string {
  if (!status) return 'Active'
  switch (status) {
    case 'failed': return 'Failed'
    case 'passed': return 'Passed'
    case 'active': return 'Active'
    case 'funded': return 'Funded'
    default: return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

function formatCurrency(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

function formatCompactCurrency(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '$0'
  if (Math.abs(amount) >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`
  }
  return formatCurrency(amount)
}

type FilterType = 'all' | 'live' | 'prop-firm'
type FilterStatus = 'all' | 'failed' | 'archived'

export default function AccountsPage() {
  const router = useRouter()
  const { refreshAllData, isDemoMode } = useData()
  const { demoRouteHref } = usePublicSurfaceRouting()
  const { user } = useAuth()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const userStore = useUserStore(state => state.user)
  const queryClient = useQueryClient()
  const scope = useQueryScope()

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 400)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const { accounts: serverAccounts, isLoading, refetch: refetchAccounts, updateAccountInCache, pagination } = useAccounts({
    page,
    limit: 50,
    status: filterStatus as any,
    type: filterType,
    search: debouncedSearch
  })

  useDatabaseRealtime({
    userId: userStore?.id,
    enabled: !!userStore?.id,
    onAccountChange: (change) => {
      if (['Account', 'MasterAccount', 'PhaseAccount'].includes(change.table)) {
        const accountId = change.newRecord?.id || change.oldRecord?.id
         if (accountId && change.event === 'UPDATE' && change.newRecord) {
           updateAccountInCache(accountId as string, change.newRecord as any)
        } else {
           refetchAccounts()
        }
      }
    },
    onTradeChange: () => {
      refetchAccounts()
    }
  })

  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const [createLiveDialogOpen, setCreateLiveDialogOpen] = useState(false)
  const [createPropFirmDialogOpen, setCreatePropFirmDialogOpen] = useState(false)
  const [editLiveDialogOpen, setEditLiveDialogOpen] = useState(false)
  const [editPropFirmDialogOpen, setEditPropFirmDialogOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchQuery])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const filterParam = urlParams.get('filter')
    if (filterParam === 'prop-firm' || filterParam === 'live') {
      setFilterType(filterParam)
      urlParams.delete('filter')
      const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const accountStats = useMemo(() => {
    const totalEquity = serverAccounts.reduce((sum, account) => sum + (account.calculatedEquity || account.startingBalance || 0), 0)
    const pnl = serverAccounts.reduce((sum, acc) => sum + (acc.pnl || 0), 0)
    const totalTrades = serverAccounts.reduce((sum, account) => sum + (account.tradeCount || 0), 0)

    return {
      total: pagination?.total || serverAccounts.length,
      live: serverAccounts.filter(a => a.accountType === 'live').length,
      propFirm: serverAccounts.filter(a => a.accountType === 'prop-firm').length,
      funded: serverAccounts.filter(a => a.accountType === 'prop-firm' && isAccountFunded(a as any)).length,
      totalEquity,
      pnl,
      totalTrades
    }
  }, [serverAccounts, pagination])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {

      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })
      toast.success("Accounts refreshed")
    } catch (error) {
      reportClientError(error, { operation: 'refresh-accounts', route: '/dashboard/accounts' })
      toast.error("Failed to refresh accounts")
    } finally {
      setIsRefreshing(false)
    }
  }, [queryClient, scope])

  const handleAccountCreated = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) }),
      queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.propFirmAccounts(scope) }),
    ])
    refreshAllData()
    setCreateLiveDialogOpen(false)
    setCreatePropFirmDialogOpen(false)
    toast.success("Account created successfully")
  }, [queryClient, scope, refreshAllData])

  const handleAccountUpdated = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) }),
      queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.propFirmAccounts(scope) }),
    ])
    refreshAllData()
    setEditLiveDialogOpen(false)
    setEditPropFirmDialogOpen(false)
    setEditingAccount(null)
    toast.success("Account updated successfully")
  }, [queryClient, scope, refreshAllData])

  const handleViewAccount = useCallback((account: Account) => {
    if (account.accountType === 'prop-firm') {
      const masterAccountId = account.currentPhaseDetails?.masterAccountId || account.id
      router.push(demoRouteHref(`/dashboard/prop-firm/accounts/${masterAccountId}`, Boolean(isDemoMode)))
    } else {
      router.push(demoRouteHref(`/dashboard/accounts/${account.id}`, Boolean(isDemoMode)))
    }
  }, [demoRouteHref, router, isDemoMode])

  const handleEditAccount = useCallback((account: Account) => {
    setEditingAccount(account)
    if (account.accountType === 'live') {
      setEditLiveDialogOpen(true)
    } else {
      setEditPropFirmDialogOpen(true)
    }
  }, [])

  const handleDeleteAccount = useCallback((account: Account) => {
    setDeletingAccount(account)
  }, [])

  const confirmDeleteAccount = useCallback(async () => {
    if (!deletingAccount) return

    const accountName = deletingAccount.displayName || deletingAccount.name || deletingAccount.number

    if (deleteConfirmText !== accountName) {
      toast.error("Please type the account name exactly to confirm")
      return
    }

    try {
      const accountId = deletingAccount.accountType === 'prop-firm'
        ? (deletingAccount.currentPhaseDetails?.masterAccountId || deletingAccount.id)
        : deletingAccount.id

      await deleteAccountRequest({ accountType: deletingAccount.accountType, accountId })

      toast.success(`${accountName} deleted permanently`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.propFirmAccounts(scope) }),
      ])
      await refreshAllData()
      setDeletingAccount(null)
      setDeleteConfirmText('')
    } catch (error) {
      reportClientError(error, { operation: 'delete-live-account', route: '/dashboard/accounts' })
      toast.error("Failed to delete account")
    }
  }, [deletingAccount, queryClient, scope, refreshAllData, deleteConfirmText])

  const handleArchiveAccount = useCallback(async (account: Account) => {
    const accountName = account.displayName || account.name || account.number
    const isArchived = account.isArchived || false

    try {
      const accountId = account.accountType === 'prop-firm'
        ? (account.currentPhaseDetails?.masterAccountId || account.id)
        : account.id

      await setAccountArchived({ accountType: account.accountType, accountId }, !isArchived)

      toast.success(isArchived ? `${accountName} restored` : `${accountName} archived`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.propFirmAccounts(scope) }),
      ])
    } catch (error) {
      reportClientError(error, { operation: isArchived ? 'restore-account' : 'archive-account', route: '/dashboard/accounts' })
      toast.error("Failed to update account")
    }
  }, [queryClient, scope])

  return (
    <TooltipProvider>
      {                                                                    }
      <CreateLiveAccountDialog open={createLiveDialogOpen} onOpenChange={setCreateLiveDialogOpen} onSuccess={handleAccountCreated} />
      <CreatePropFirmDialog open={createPropFirmDialogOpen} onOpenChange={setCreatePropFirmDialogOpen} onSuccess={handleAccountCreated} />
      <EditLiveAccountDialog open={editLiveDialogOpen} onOpenChange={setEditLiveDialogOpen} account={editingAccount as any} onSuccess={handleAccountUpdated} />
      <EditPropFirmAccountDialog open={editPropFirmDialogOpen} onOpenChange={setEditPropFirmDialogOpen} account={editingAccount as any} onSuccess={handleAccountUpdated} />

      <AlertDialog open={!!deletingAccount} onOpenChange={(open) => !open && setDeletingAccount(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <HugeiconsIcon icon={PencilEdit01Icon} className="h-5 w-5 text-destructive" />
              </div>
              <span>Delete Account</span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will permanently delete <strong>{deletingAccount?.displayName || deletingAccount?.name || deletingAccount?.number}</strong> and all associated data including:
                </p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• All trades and history</li>
                  <li>• Performance analytics</li>
                  <li>• Screenshots and media</li>
                  {deletingAccount?.accountType === 'prop-firm' && (
                    <li>• Phase progress and payouts</li>
                  )}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-sm">
              Type <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                {deletingAccount?.displayName || deletingAccount?.name || deletingAccount?.number}
              </code> to confirm
            </Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deletingAccount?.displayName || deletingAccount?.name || deletingAccount?.number}
              className="font-mono text-sm"
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && deleteConfirmText === (deletingAccount?.displayName || deletingAccount?.name || deletingAccount?.number)) confirmDeleteAccount()
              }}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeletingAccount(null)
              setDeleteConfirmText('')
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAccount}
              disabled={deleteConfirmText !== (deletingAccount?.displayName || deletingAccount?.name || deletingAccount?.number)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {                                      }
      {isLoading && serverAccounts.length === 0 ? (
        <AccountsPageSkeleton />
      ) : (
        <div className="min-h-screen bg-background">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">

          {            }
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <PageHeader
              title="Accounts"
              actions={
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="tertiary"
                        size="icon"
                        aria-label="Refresh accounts"
                        title="Refresh accounts"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                      >
                        {isRefreshing ? <Spinner className="h-4 w-4" /> : <HugeiconsIcon icon={RefreshIcon} className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh accounts</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="h-9 gap-2" data-tour="add-account-btn" onClick={() => emitTourEvent('account.create.started')}>
                        <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
                        <span className="hidden sm:inline">New Account</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => { setCreateLiveDialogOpen(true); emitTourEvent('account.create.form.opened') }} className="gap-3 py-2.5" data-tour="create-live-item">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                          <HugeiconsIcon icon={User02Icon} className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium">Live Account</div>
                          <div className="text-xs text-muted-foreground">Personal trading</div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setCreatePropFirmDialogOpen(true); emitTourEvent('account.create.form.opened') }} className="gap-3 py-2.5" data-tour="create-prop-item">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                          <HugeiconsIcon icon={Building02Icon} className="h-4 w-4 text-muted-foreground"  />
                        </div>
                        <div>
                          <div className="font-medium">Prop Firm</div>
                          <div className="text-xs text-muted-foreground">Funded challenge</div>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              }
            />
          </motion.div>

          {                    }
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6"
          >
            <StatCard
              label="Total Equity"
              value={formatCompactCurrency(accountStats.totalEquity)}
              icon={<HugeiconsIcon icon={Wallet01Icon} className="h-4 w-4" />}
              trend={accountStats.pnl >= 0 ? 'up' : 'down'}
              trendValue={`${accountStats.pnl >= 0 ? '+' : ''}${formatCompactCurrency(accountStats.pnl)}`}
            />
            <StatCard
              label="Accounts"
              value={accountStats.total}
              icon={<HugeiconsIcon icon={ActivityIcon} className="h-4 w-4" />}
              subtext={`${accountStats.live} live, ${accountStats.propFirm} prop`}
            />
            <StatCard
              label="Funded"
              value={accountStats.funded}
              icon={<HugeiconsIcon icon={Award01Icon} className="h-4 w-4" />}
              highlight={accountStats.funded > 0}
            />
            <StatCard
              label="Total Trades"
              value={accountStats.totalTrades.toLocaleString()}
              icon={<HugeiconsIcon icon={BarChartIcon} className="h-4 w-4" />}
            />
          </motion.div>

          {             }
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-3 mb-6"
          >
            {            }
            <div className="relative flex-1 max-w-md">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" strokeWidth={1.5} color="currentColor" />
              <Input
                ref={searchInputRef}
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-20 h-9"
              />
              {searchQuery ? (
                <Button
                  variant="tertiary"
                  size="icon"
                  aria-label="Clear account search"
                  title="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery('')}
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
                </Button>
              ) : (
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">Cmd</span>K
                </kbd>
              )}
            </div>

            {                      }
            <Tabs value={filterType} onValueChange={(v) => setFilterType(v as FilterType)} className="w-full sm:w-auto">
              <TabsList className="w-full sm:w-auto grid grid-cols-3">
                <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
                <TabsTrigger value="live" className="text-xs px-3 gap-1.5">
                  <HugeiconsIcon icon={User02Icon} className="h-3 w-3" />
                  <span className="hidden sm:inline">Live</span>
                </TabsTrigger>
                <TabsTrigger value="prop-firm" className="text-xs px-3 gap-1.5">
                  <HugeiconsIcon icon={Building02Icon} className="h-3 w-3" />
                  <span className="hidden sm:inline">Prop</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {                   }
            <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)} className="w-full sm:w-auto">
              <TabsList className="w-full sm:w-auto grid grid-cols-3">
                <TabsTrigger value="all" className="text-xs px-3">Active</TabsTrigger>
                <TabsTrigger value="failed" className="text-xs px-3">Failed</TabsTrigger>
                <TabsTrigger value="archived" className="text-xs px-3">Archived</TabsTrigger>
              </TabsList>
            </Tabs>

            {                        }
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setShowLeaderboard(prev => !prev)}
              className={cn(
                "gap-1.5 text-xs shrink-0",
                showLeaderboard ? "text-primary" : "text-muted-foreground"
              )}
            >
              <HugeiconsIcon icon={Medal01Icon} className="h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" />
              {showLeaderboard ? 'Hide' : 'Leaderboard'}
            </Button>
          </motion.div>

          {                 }
          {showLeaderboard && serverAccounts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <AccountLeaderboard accounts={serverAccounts as any} />
            </motion.div>
          )}

          {                   }
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            {serverAccounts.length === 0 ? (
              <EmptyState
                hasAccounts={true}
                searchQuery={searchQuery}
                onCreateLive={() => setCreateLiveDialogOpen(true)}
                onCreatePropFirm={() => setCreatePropFirmDialogOpen(true)}
                onClearSearch={() => setSearchQuery('')}
              />
            ) : (
              <div className={cn(
                "grid gap-5",
                serverAccounts.length === 1
                  ? "max-w-5xl grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3"
                  : "grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3"
              )}>
                <AnimatePresence mode="popLayout">
                  {serverAccounts.map((account, index) => (
                    <motion.div
                      key={account.id}
                      data-tour="account-card"
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.02, duration: 0.2 }}
                    >
                      <AccountCard
                        account={account as any}
                        allAccounts={serverAccounts as any}
                        onView={() => handleViewAccount(account as any)}
                        onEdit={() => handleEditAccount(account as any)}
                        onDelete={() => handleDeleteAccount(account as any)}
                        onArchive={() => handleArchiveAccount(account as any)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>

        </div>
      )}
    </TooltipProvider>
  )
}

function StatCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  subtext,
  highlight
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  trend?: 'up' | 'down'
  trendValue?: string
  subtext?: string
  highlight?: boolean
}) {
  return (
    <Card className={cn(
      "h-24 flex flex-col justify-center relative overflow-hidden transition-all",
      highlight && "ring-1 ring-primary/20 bg-primary/5"
    )}>
      <CardContent className="px-5 py-4 h-full flex flex-col justify-center gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground/80">
            {label}
          </span>
          <div className={cn(
            "h-3.5 w-3.5 opacity-50",
            highlight ? "text-primary" : "text-muted-foreground"
          )}>
            {icon}
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-2xl font-bold tracking-tight truncate">{value}</p>
          {(trend && trendValue) ? (
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-bold",
              trend === 'up' ? "text-long" : "text-short"
            )}>
              {trend === 'up' ? <HugeiconsIcon icon={TrendingUpDownIcon} className="h-2.5 w-2.5"  /> : <HugeiconsIcon icon={TrendingUpDownIcon} className="h-2.5 w-2.5"  />}
              {trendValue}
            </div>
          ) : subtext ? (
            <p className="text-[10px] text-muted-foreground/60 font-medium truncate">{subtext}</p>
          ) : null}
        </div>
        {highlight && (
          <HugeiconsIcon icon={SparklesIcon} className="absolute -right-1 -bottom-1 h-12 w-12 text-primary/5 pointer-events-none" strokeWidth={1.5} color="currentColor" />
        )}
      </CardContent>
    </Card>
  )
}

function AccountCard({
  account,
  allAccounts,
  onView,
  onEdit,
  onDelete,
  onArchive
}: {
  account: Account & { calculatedEquity?: number }
  allAccounts: (Account & { calculatedEquity?: number })[]
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onArchive: () => void
}) {
  const isPropFirm = account.accountType === 'prop-firm'
  const isFunded = isPropFirm && isAccountFunded(account)
  const isFailed = account.status === 'failed'
  const isArchived = account.isArchived

  const equity = account.calculatedEquity ?? account.startingBalance ?? 0
  const startingBalance = account.startingBalance || 0
  const pnl = equity - startingBalance
  const pnlPercent = startingBalance > 0 ? (pnl / startingBalance) * 100 : 0

  const displayTradeCount = account.tradeCount || 0

  const isAtRisk = isPropFirm && !isFailed && (
    (account.dailyDrawdownRemaining && account.dailyDrawdownRemaining < 500) ||
    (account.maxDrawdownRemaining && account.maxDrawdownRemaining < 1000)
  )

  const phaseLabel = account.currentPhaseDetails?.phaseNumber
    ? `Phase ${account.currentPhaseDetails.phaseNumber}`
    : getStatusDisplayName(account.status)

  const liveMeta = [
    { label: 'Broker', value: account.broker || 'Manual' },
    { label: 'Number', value: account.number },
    { label: 'Start', value: formatCurrency(startingBalance) },
    { label: 'Status', value: getStatusDisplayName(account.status) },
  ]

  const propMeta = [
    { label: 'Evaluation', value: account.currentPhaseDetails?.evaluationType || 'Evaluation' },
    { label: 'Phase', value: phaseLabel },
    { label: 'Max Loss Left', value: `${formatCurrency(account.maxDrawdownRemaining || 0)}` },
    { label: 'Daily Loss Left', value: `${formatCurrency(account.dailyDrawdownRemaining || 0)}` },
  ]

  const detailItems = isPropFirm ? propMeta : liveMeta

  return (
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden border border-border/40 bg-card/90 transition-all duration-200 hover:border-border/60 hover:shadow-md",
        isFailed && "border-destructive/40",
        isArchived && "opacity-70",
        isFunded && "ring-1 ring-primary/25",
        isAtRisk && !isFailed && "ring-1 ring-destructive/25"
      )}
    >
      <button
        type="button"
        className="absolute inset-0 z-0"
        onClick={onView}
        aria-label={`View account ${account.displayName || account.name || account.number}`}
      />
      <CardContent className="pointer-events-none relative z-[1] p-4 pt-5">
        {            }
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
              isFailed ? "bg-destructive/10" :
                isFunded ? "bg-primary/10" :
                  "bg-muted"
            )}>
              {isFailed ? (
                <HugeiconsIcon icon={CircleXIcon} className="h-4 w-4 text-destructive" />
              ) : isFunded ? (
                <HugeiconsIcon icon={Award01Icon} className="h-4 w-4 text-primary" />
              ) : isPropFirm ? (
                <HugeiconsIcon icon={Building02Icon} className="h-4 w-4 text-muted-foreground" />
              ) : (
                <HugeiconsIcon icon={User02Icon} className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm truncate">
                {account.displayName || account.name || account.number}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="h-5 border-border/30 px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {isPropFirm ? 'Prop Firm' : 'Live'}
                </Badge>
                {isPropFirm && (
                  <Badge variant="outline" className="h-5 border-border/30 px-1.5 text-[10px]">
                    {phaseLabel}
                  </Badge>
                )}
                {!isPropFirm && (
                  <Badge variant="outline" className="h-5 border-border/30 px-1.5 text-[10px]">
                    {account.broker || 'Personal'}
                  </Badge>
                )}
                <Badge
                  variant={isFailed ? "destructive" : isFunded ? "default" : "secondary"}
                  className="h-5 px-1.5 text-[10px] capitalize"
                >
                  {isFunded ? 'Funded' : getStatusDisplayName(account.status)}
                </Badge>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <RevealAction
                variant="icon-only"
                size="icon"
                className="h-10 w-10 flex-shrink-0"
                aria-label="Account options"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
              </RevealAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView() }}>
                <HugeiconsIcon icon={EyeIcon} className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit() }}>
                <HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive() }}>
                {isArchived ? (
                  <>
                    <HugeiconsIcon icon={Rotate01Icon} className="h-4 w-4 mr-2" />
                    Restore
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={ArchiveIcon} className="h-4 w-4 mr-2" />
                    Archive
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="text-destructive focus:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 mr-2"  />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {             }
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-bold tracking-tight">
                {formatCurrency(equity)}
              </p>
              <div className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium",
                pnl >= 0 ? "text-long" : "text-short"
              )}>
                {pnl >= 0 ? <HugeiconsIcon icon={TrendingUpDownIcon} className="h-3 w-3" /> : <HugeiconsIcon icon={TrendingUpDownIcon} className="h-3 w-3" />}
                <span>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</span>
                <span className="text-muted-foreground">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Trades</p>
              <p className="text-sm font-semibold">{displayTradeCount}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/18 bg-muted/10 p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {detailItems.map((item) => (
                <div key={item.label}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {                                }
          {isPropFirm && !isFunded && !isFailed && account.profitTargetProgress !== undefined && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <HugeiconsIcon icon={Target01Icon} className="h-3 w-3" />
                  Profit Target
                </span>
                <span className="font-medium">{account.profitTargetProgress.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    account.profitTargetProgress >= 100
                      ? "bg-long"
                      : "bg-primary"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, account.profitTargetProgress))}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {                  }
          {isAtRisk && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/18 bg-destructive/10 p-2 text-destructive">
              <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} color="currentColor" />
              <span className="text-xs font-medium">Near drawdown limit</span>
            </div>
          )}
        </div>

        {                       }
        <div className="mt-4 flex items-center justify-between border-t border-border/18 pt-3 text-xs text-muted-foreground">
          <span className="truncate">{isPropFirm ? (account.currentPhaseDetails?.evaluationType || 'Evaluation') : 'Live account'}</span>
          <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            View details <HugeiconsIcon icon={ChevronRightIcon} className="h-3 w-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function AccountLeaderboard({ accounts }: { accounts: Account[] }) {
  const sorted = [...accounts].sort((a, b) => (b.pnl || 0) - (a.pnl || 0))
  const maxPnl = accounts.reduce((max, a) => Math.max(max, Math.abs(a.pnl || 0)), 1)
  const totalPnl = accounts.reduce((sum, a) => sum + (a.pnl || 0), 0)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  return (
    <Card className="border-border/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Medal01Icon} className="h-4 w-4 text-primary" strokeWidth={1.5} color="currentColor" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account Leaderboard</span>
          </div>
          <span className={cn(
            "text-[10px] font-black",
            totalPnl >= 0 ? "text-long" : "text-short"
          )}>
            Total: {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
          </span>
        </div>
        <div className="space-y-1">
          {sorted.map((acc, i) => {
            const pnl = acc.pnl || 0
            const isPositive = pnl >= 0
            const barWidth = maxPnl > 0 ? (Math.abs(pnl) / maxPnl) * 100 : 0
            const rankColor = i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground/30"

            return (
              <div key={acc.id} className="flex items-center gap-3 py-1.5 group">
                <span className={cn("w-5 text-center text-xs font-black", rankColor)}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate">{acc.displayName || acc.name || acc.number}</span>
                    <span className={cn("text-xs font-black shrink-0 ml-2", isPositive ? "text-long" : "text-short")}>
                      {isPositive ? '+' : ''}{formatCurrency(pnl)}
                    </span>
                  </div>
                  <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", isPositive ? "bg-long" : "bg-short")}
                      style={{ width: `${Math.min(100, barWidth)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {sorted.length >= 2 && (
          <div className="flex items-center gap-4 pt-2 border-t border-border/20">
            <div className="flex items-center gap-1.5 text-xs">
              <HugeiconsIcon icon={ArrowUp01Icon} className="h-3 w-3 text-long" />
              <span className="text-muted-foreground text-[10px]">Best:</span>
              <span className="font-semibold truncate max-w-[120px]">{best?.displayName || best?.name || best?.number}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-short" />
              <span className="text-muted-foreground text-[10px]">Worst:</span>
              <span className="font-semibold truncate max-w-[120px]">{worst?.displayName || worst?.name || worst?.number}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({
  hasAccounts,
  searchQuery,
  onCreateLive,
  onCreatePropFirm,
  onClearSearch
}: {
  hasAccounts: boolean
  searchQuery: string
  onCreateLive: () => void
  onCreatePropFirm: () => void
  onClearSearch: () => void
}) {
  if (hasAccounts || searchQuery) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <HugeiconsIcon icon={Search01Icon} className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} color="currentColor" />
          </div>
          <h3 className="font-semibold mb-1">No accounts found</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {searchQuery
              ? `No accounts match "${searchQuery}"`
              : "Try adjusting your filters"
            }
          </p>
          {searchQuery && (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onClearSearch}>
              Clear search
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-20">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
            <HugeiconsIcon icon={Wallet01Icon} className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} color="currentColor" />
          </div>
          <div className="absolute -right-2 -bottom-2 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-2">Create your first account</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Add a trading account to start tracking your performance, analyzing trades, and growing as a trader.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onCreateLive} className="gap-2">
            <HugeiconsIcon icon={User02Icon} className="h-4 w-4" />
            Live Account
          </Button>
          <Button onClick={onCreatePropFirm} variant="secondary" className="gap-2">
            <HugeiconsIcon icon={Building02Icon} className="h-4 w-4" />
            Prop Firm Account
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
