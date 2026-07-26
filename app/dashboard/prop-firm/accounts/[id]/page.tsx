'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from "@/context/auth-provider"
import { toast } from "sonner"
import { motion, AnimatePresence } from 'framer-motion'
import { usePropFirmRealtime } from "@/hooks/use-prop-firm-realtime"
import { useDatabaseRealtime } from "@/lib/realtime/database-realtime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  TrendingUp,
  Target,
  AlertTriangle,
  Shield,
  DollarSign,
  Settings as SettingsIcon,
  RefreshCw,
  CreditCard,
  ChevronRight,
  PenLine,
  Check,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AccountStatus } from "@/types/prop-firm"
import { AccountNotFoundError, ConnectionError } from "@/components/prop-firm/account-error-boundary"
import { HistoryTab } from "./components/history-tab"
import { calculateWinRate } from '@/lib/metrics/outcome'

import { DetailPageSkeleton } from "./components/detail-skeleton"
import { MetricCard } from "./components/metric-card"
import { TradeRow } from "./components/trade-row"
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'

function isFundedPhase(evaluationType: string | undefined, phaseNumber: number | undefined): boolean {
  return isFundedPhaseForEvaluation(evaluationType || '', phaseNumber || 0)
}

function getPhaseDisplayName(evaluationType: string | undefined, phaseNumber: number | undefined): string {
  if (!phaseNumber) return 'Phase 1'
  if (isFundedPhase(evaluationType, phaseNumber)) return 'Funded'
  return `Phase ${phaseNumber}`
}

function formatCurrency(amount: number | undefined | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0)
}

export default function AccountDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [accountData, setAccountData] = useState<any>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedAccountName, setEditedAccountName] = useState('')
  const [tradesData, setTradesData] = useState<any[]>([])
  const [payoutsData, setPayoutsData] = useState<any>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const hasFetchedDataRef = useRef(false)

  const accountId = params.id as string

  const {
    account: realtimeAccount,
    drawdown: realtimeDrawdown,
    isLoading,
    error: realtimeError,
    refetch,
    isConnected: isRealtimeConnected
  } = usePropFirmRealtime({
    accountId,
    enabled: !!accountId
  })

  // Fetch complete data
  const fetchCompleteData = useCallback(async () => {
    setIsLoadingData(true)
    setDataError(null)

    try {
      const [tradesRes, payoutsRes] = await Promise.all([
        fetch(`/api/v1/prop-firm/accounts/${accountId}/trades?phase=all`),
        fetch(`/api/v1/prop-firm/accounts/${accountId}/payouts`)
      ])

      const [tradesJson, payoutsJson] = await Promise.all([
        tradesRes.json(),
        payoutsRes.json()
      ])

      setTradesData(tradesJson.success ? tradesJson.data.trades : [])
      setPayoutsData(payoutsJson.success ? payoutsJson.data : { eligibility: null, history: [] })
    } catch (error) {
      setDataError('Failed to load data')
    } finally {
      setIsLoadingData(false)
    }
  }, [accountId])

  useEffect(() => {
    if (realtimeError) {
      if (realtimeError.includes('404') || realtimeError.includes('not found')) {
        toast.error("Account not found")
        setTimeout(() => router.push('/dashboard/accounts'), 2000)
      }
    }
  }, [realtimeError, router])

  // Initial data fetch
  useEffect(() => {
    if (realtimeAccount && accountId && !hasFetchedDataRef.current) {
      hasFetchedDataRef.current = true
      fetchCompleteData()
    }
  }, [realtimeAccount, accountId, fetchCompleteData])

  // Subscribe to realtime changes for trades and payouts
  useDatabaseRealtime({
    userId: user?.id,
    enabled: !!accountId && !!user?.id,
    onTradeChange: (change) => {
      // Refresh trades when trade changes for this account's phases
      if (realtimeAccount) {
        const tradePhaseAccountId = (change.newRecord?.phaseAccountId || change.oldRecord?.phaseAccountId) as string | undefined
        if (tradePhaseAccountId) {
          const accountPhaseIds = realtimeAccount.phases.map(p => p.id)
          if (accountPhaseIds.includes(tradePhaseAccountId)) {
            fetchCompleteData()
          }
        }
      }
    },
    onAccountChange: (change) => {
      // Refresh payouts when PhaseAccount or MasterAccount changes
      if (change.table === 'PhaseAccount' || change.table === 'MasterAccount') {
        const changedId = (change.newRecord?.id || change.oldRecord?.id) as string | undefined
        if (change.table === 'MasterAccount' && changedId === accountId) {
          fetchCompleteData()
        } else if (change.table === 'PhaseAccount') {
          const phaseMasterAccountId = (change.newRecord?.masterAccountId || change.oldRecord?.masterAccountId) as string | undefined
          if (phaseMasterAccountId === accountId) {
            fetchCompleteData()
          }
        }
      }
    }
  })

  // Sync realtime data
  useEffect(() => {
    if (realtimeAccount) {
      const isFunded = isFundedPhase(realtimeAccount.evaluationType, realtimeAccount.currentPhase?.phaseNumber)

      setAccountData({
        account: {
          id: realtimeAccount.id,
          name: realtimeAccount.accountName || 'Unnamed Account',
          number: realtimeAccount.currentPhase?.phaseId || `master-${realtimeAccount.id}`,
          currentBalance: realtimeAccount.currentBalance ?? realtimeAccount.accountSize ?? 0,
          currentEquity: realtimeAccount.currentEquity ?? realtimeAccount.currentBalance ?? realtimeAccount.accountSize ?? 0,
          startingBalance: realtimeAccount.accountSize ?? 0,
          status: realtimeAccount.status || 'active',
          evaluationType: realtimeAccount.evaluationType || 'Two Step',
          createdAt: realtimeAccount.lastUpdated || new Date().toISOString(),
          dailyDrawdownPercent: realtimeAccount.currentPhase?.dailyDrawdownPercent ?? 5,
          maxDrawdownPercent: realtimeAccount.currentPhase?.maxDrawdownPercent ?? 10,
          profitSplitPercent: realtimeAccount.currentPhase?.profitSplitPercent,
          payoutCycleDays: realtimeAccount.currentPhase?.payoutCycleDays,
        },
        currentPhase: {
          phaseNumber: realtimeAccount.currentPhase?.phaseNumber ?? 1,
          status: realtimeAccount.currentPhase?.status || 'active',
          profitTarget: realtimeAccount.currentPhase && realtimeAccount.accountSize
            ? (realtimeAccount.currentPhase.profitTargetPercent / 100) * realtimeAccount.accountSize
            : 0,
          grossProfitSincePhaseStart: realtimeAccount.currentGrossPnL ?? realtimeAccount.currentPnL ?? 0,
          netProfitSincePhaseStart: realtimeAccount.currentNetPnL ?? realtimeAccount.currentPnL ?? 0,
          isFunded,
        },
        drawdown: {
          dailyDrawdownRemaining: realtimeDrawdown?.dailyDrawdownRemaining ?? 0,
          maxDrawdownRemaining: realtimeDrawdown?.maxDrawdownRemaining ?? 0,
          isBreached: realtimeDrawdown?.isBreached ?? false,
          breachType: realtimeDrawdown?.breachType
        },
        progress: {
          profitProgress: realtimeAccount.profitTargetProgress ?? 0,
        },
        recentTrades: tradesData || [],
        payoutEligibility: payoutsData?.eligibility || null,
        payouts: payoutsData?.history || [],
        phases: realtimeAccount.phases || []
      })

      if (!editedAccountName) {
        setEditedAccountName(realtimeAccount.accountName || '')
      }
    }
  }, [realtimeAccount, realtimeDrawdown, tradesData, payoutsData, editedAccountName])

  const phaseSummaries = useMemo(() => {
    const map = new Map<string, {
      totalTrades: number
      totalPnL: number
      wins: number
      losses: number
      winRate: number
      profitProgress: number
    }>()

    for (const phase of accountData?.phases || []) {
      map.set(phase.id, {
        totalTrades: Number(phase.tradeCount ?? 0),
        totalPnL: Number(phase.totalPnL ?? 0),
        wins: Number(phase.wins ?? 0),
        losses: Number(phase.losses ?? 0),
        winRate: Number(phase.winRate ?? 0),
        profitProgress: Number(phase.profitProgress ?? 0),
      })
    }

    return map
  }, [accountData?.phases])

  const getPhaseSummary = useCallback((phase: any) => {
    return phaseSummaries.get(phase.id) ?? {
      totalTrades: 0,
      totalPnL: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      profitProgress: 0,
    }
  }, [phaseSummaries])

  // Computed values
  const stats = useMemo(() => {
    if (phaseSummaries.size > 0) {
      const values = Array.from(phaseSummaries.values())
      const totalTrades = values.reduce((sum, phase) => sum + phase.totalTrades, 0)
      const totalPnl = values.reduce((sum, phase) => sum + phase.totalPnL, 0)
      const wins = values.reduce((sum, phase) => sum + phase.wins, 0)
      const losses = values.reduce((sum, phase) => sum + phase.losses, 0)

      return {
        totalTrades,
        winRate: Math.round(calculateWinRate(wins, losses)),
        totalPnl,
        avgTrade: totalTrades > 0 ? totalPnl / totalTrades : 0,
        wins,
        losses
      }
    }

    return null
  }, [phaseSummaries])

  const handleRefresh = async () => {
    hasFetchedDataRef.current = false
    await refetch()
    await fetchCompleteData()
  }

  const handleSaveName = async () => {
    try {
      const response = await fetch(`/api/v1/prop-firm/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: editedAccountName })
      })

      if (!response.ok) throw new Error('Failed to update')

      toast.success("Name updated")
      setIsEditingName(false)
      await refetch()
    } catch (error) {
      toast.error("Failed to update name")
    }
  }

  const getStatusVariant = (status: AccountStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'funded': return 'default'
      case 'active': return 'outline'
      case 'failed': return 'destructive'
      case 'passed': return 'secondary'
      default: return 'outline'
    }
  }

  // Loading state
  if (isLoading || (!accountData && !realtimeError)) {
    return <DetailPageSkeleton />
  }

  // Error states
  if (realtimeError) {
    if (realtimeError.includes('404') || realtimeError.includes('not found')) {
      return (
        <AccountNotFoundError
          accountId={accountId}
          onRetry={refetch}
          onGoBack={() => router.push('/dashboard/accounts')}
        />
      )
    }
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <ConnectionError error={realtimeError} onRetry={refetch} />
      </div>
    )
  }

  if (!accountData) {
    return (
      <AccountNotFoundError
        accountId={accountId}
        onRetry={refetch}
        onGoBack={() => router.push('/dashboard/accounts')}
      />
    )
  }

  const { account, currentPhase, drawdown, progress, payoutEligibility } = accountData

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/accounts')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Accounts
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedAccountName}
                      onChange={(e) => setEditedAccountName(e.target.value)}
                      className="h-8 w-48"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveName} aria-label="Confirm rename">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingName(false)} aria-label="Cancel rename">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    {account.name}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Rename account"
                      title="Rename account"
                      className="h-6 w-6"
                      onClick={() => setIsEditingName(true)}
                    >
                      <PenLine className="h-3 w-3" />
                    </Button>
                  </h1>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getStatusVariant(account.status)}>
                  {currentPhase.isFunded ? 'Funded' : account.status === 'active' ? 'Active' : account.status}
                </Badge>
                <Badge variant="outline">
                  {getPhaseDisplayName(account.evaluationType, currentPhase?.phaseNumber)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {realtimeAccount?.propFirmName} • {account.evaluationType}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </motion.div>

        {/* Breach Alert */}
        <AnimatePresence>
          {drawdown.isBreached && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Account breached {drawdown.breachType === 'daily_drawdown' ? 'daily' : 'max'} drawdown limit.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <MetricCard
            label="Current Balance"
            value={formatCurrency(account.currentBalance)}
            subtext={`Started: ${formatCurrency(account.startingBalance)}`}
            icon={<DollarSign className="h-5 w-5" />}
            trend={(account.currentBalance - account.startingBalance) >= 0 ? 'positive' : 'negative'}
          />
          <MetricCard
            label="Daily Drawdown"
            value={formatCurrency(drawdown.dailyDrawdownRemaining)}
            subtext={`Limit: ${account.dailyDrawdownPercent}%`}
            icon={<Shield className="h-5 w-5" />}
            trend={drawdown.dailyDrawdownRemaining < 500 ? 'negative' : 'positive'}
            warning={drawdown.dailyDrawdownRemaining < 500}
          />
          <MetricCard
            label="Max Drawdown"
            value={formatCurrency(drawdown.maxDrawdownRemaining)}
            subtext={`Limit: ${account.maxDrawdownPercent}%`}
            icon={<AlertTriangle className="h-5 w-5" />}
            trend={drawdown.maxDrawdownRemaining < 1000 ? 'negative' : 'positive'}
            warning={drawdown.maxDrawdownRemaining < 1000}
          />
          <MetricCard
            label={currentPhase.isFunded ? "Total Profit" : "Progress"}
            value={currentPhase.isFunded
              ? formatCurrency(currentPhase.netProfitSincePhaseStart)
              : `${Math.min(progress.profitProgress, 100).toFixed(1)}%`}
            subtext={currentPhase.isFunded
              ? `Split: ${account.profitSplitPercent || 80}%`
              : `Target: ${formatCurrency(currentPhase.profitTarget)}`}
            icon={<Target className="h-5 w-5" />}
            trend={(currentPhase.isFunded ? currentPhase.netProfitSincePhaseStart : currentPhase.grossProfitSincePhaseStart) >= 0 ? 'positive' : 'negative'}
          />
        </motion.div>

        {/* Progress Bar (Non-funded only) */}
        {!currentPhase.isFunded && currentPhase.profitTarget > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Profit Target Progress</span>
                  <span className="text-sm font-medium">{Math.min(progress.profitProgress, 100).toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(progress.profitProgress, 100)} className="h-2" />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Current: {formatCurrency(currentPhase.grossProfitSincePhaseStart)}</span>
                  <span>Target: {formatCurrency(currentPhase.profitTarget)}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto rounded-2xl bg-muted/15 p-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trades">Trades</TabsTrigger>
              {currentPhase.isFunded && <TabsTrigger value="payouts">Payouts</TabsTrigger>}
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Quick Stats */}
              {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold">{stats.totalTrades}</p>
                      <p className="text-xs text-muted-foreground">Total Trades</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className={cn("text-3xl font-bold", stats.winRate >= 50 ? "text-long" : "text-short")}>
                        {stats.winRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className={cn("text-3xl font-bold", stats.totalPnl >= 0 ? "text-long" : "text-short")}>
                        {formatCurrency(stats.totalPnl)}
                      </p>
                      <p className="text-xs text-muted-foreground">Total P&L</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className={cn("text-3xl font-bold", stats.avgTrade >= 0 ? "text-long" : "text-short")}>
                        {formatCurrency(stats.avgTrade)}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg per Trade</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Phase Performance */}
              {accountData.phases?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Phase Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {accountData.phases.map((phase: any) => {
                        const phaseSummary = getPhaseSummary(phase)
                        const phasePnL = phaseSummary.totalPnL
                        const winRate = Math.round(phaseSummary.winRate)

                        return (
                          <div key={phase.id} className="rounded-2xl border border-border/30 bg-muted/15 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Badge variant={phase.status === 'active' ? 'default' : 'secondary'}>
                                  {getPhaseDisplayName(account.evaluationType, phase.phaseNumber)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{phase.status}</span>
                              </div>
                              <span className={cn("font-semibold", phasePnL >= 0 ? "text-long" : "text-short")}>
                                {formatCurrency(phasePnL)}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Trades</p>
                                <p className="font-medium">{phaseSummary.totalTrades}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Win Rate</p>
                                <p className={cn("font-medium", winRate >= 50 ? "text-long" : "text-short")}>{winRate}%</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">W/L</p>
                                <p className="font-medium">
                                  <span className="text-long">{phaseSummary.wins}</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className="text-short">{phaseSummary.losses}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Trades Preview */}
              {tradesData.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Recent Trades</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('trades')}>
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card/40">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr className="text-left text-xs">
                            <th className="p-3 font-medium">Symbol</th>
                            <th className="p-3 font-medium">Side</th>
                            <th className="p-3 font-medium">Qty</th>
                            <th className="p-3 font-medium">P&L</th>
                            <th className="p-3 font-medium">Phase</th>
                            <th className="p-3 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tradesData.slice(0, 5).map((trade: any, index: number) => (
                            <TradeRow key={trade.id || index} trade={trade} evaluationType={account.evaluationType} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Trades Tab */}
            <TabsContent value="trades">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">All Trades</CardTitle>
                  <Badge variant="secondary">{tradesData.length} Total</Badge>
                </CardHeader>
                <CardContent>
                  {isLoadingData ? (
                    <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card/40">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr className="text-left text-xs">
                            <th className="p-3 font-medium">Symbol</th>
                            <th className="p-3 font-medium">Side</th>
                            <th className="p-3 font-medium">Qty</th>
                            <th className="p-3 font-medium">P&L</th>
                            <th className="p-3 font-medium">Phase</th>
                            <th className="p-3 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <tr key={i} className="border-t">
                              <td className="p-3"><Skeleton className="h-4 w-16" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-12" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-10" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-16" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-14" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : tradesData.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No trades yet</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr className="text-left text-xs">
                            <th className="p-3 font-medium">Symbol</th>
                            <th className="p-3 font-medium">Side</th>
                            <th className="p-3 font-medium">Qty</th>
                            <th className="p-3 font-medium">P&L</th>
                            <th className="p-3 font-medium">Phase</th>
                            <th className="p-3 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tradesData.map((trade: any, index: number) => (
                            <TradeRow key={trade.id || index} trade={trade} evaluationType={account.evaluationType} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payouts Tab */}
            {currentPhase.isFunded && (
              <TabsContent value="payouts" className="space-y-6">
                {/* Eligibility */}
                {payoutEligibility && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Payout Eligibility
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span>Status</span>
                          <Badge variant={payoutEligibility.isEligible ? "default" : "secondary"}>
                            {payoutEligibility.isEligible ? "Eligible" : "Not Eligible"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Profit Available</p>
                            <p className="font-medium">{formatCurrency(payoutEligibility.netProfitSinceLastPayout)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Days Since Last Payout</p>
                            <p className="font-medium">{payoutEligibility.daysSinceLastPayout}</p>
                          </div>
                        </div>
                        {payoutEligibility.blockers?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Blockers:</p>
                            {payoutEligibility.blockers.map((blocker: string, i: number) => (
                              <p key={i} className="text-sm text-destructive flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {blocker}
                              </p>
                            ))}
                          </div>
                        )}
                        {payoutEligibility.isEligible && (
                          <Button
                            className="w-full"
                            onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/payouts/request`)}
                          >
                            Request Payout
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Payout History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Payout History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {accountData.payouts?.length === 0 ? (
                      <div className="text-center py-8">
                        <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No payouts yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {accountData.payouts?.map((payout: any) => (
                          <div key={payout.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{formatCurrency(payout.amountPaid || payout.amount)}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(payout.paidAt || payout.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant={payout.status === 'PAID' ? 'default' : 'secondary'}>
                              {payout.status || 'COMPLETED'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* History Tab */}
            <TabsContent value="history">
              <HistoryTab
                accountName={account.name}
                propFirmName={realtimeAccount?.propFirmName || 'Prop Firm'}
                accountSize={account.startingBalance}
                breaches={[]}
                evaluationType={account.evaluationType}
                phases={accountData.phases?.map((phase: any) => {
                  const phaseSummary = getPhaseSummary(phase)

                  return {
                    id: phase.id,
                    phaseNumber: phase.phaseNumber,
                    phaseId: phase.phaseId,
                    status: phase.status,
                    startDate: phase.startDate,
                    endDate: phase.endDate,
                    totalTrades: phaseSummary.totalTrades,
                    totalPnL: phaseSummary.totalPnL,
                    winRate: phaseSummary.winRate,
                    profitTargetPercent: phase.profitTargetPercent,
                    profitProgress: phaseSummary.profitProgress,
                  }
                }) || []}
              />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <SettingsIcon className="h-5 w-5" />
                      Account Details
                    </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Account ID</p>
                        <p className="font-medium text-sm break-all">{account.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Prop Firm</p>
                        <p className="font-medium">{realtimeAccount?.propFirmName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Evaluation Type</p>
                        <p className="font-medium">{account.evaluationType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Account Size</p>
                        <p className="font-medium">{formatCurrency(account.startingBalance)}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Current Phase</p>
                        <p className="font-medium">{getPhaseDisplayName(account.evaluationType, currentPhase.phaseNumber)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant={getStatusVariant(account.status)}>{account.status}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="font-medium">{new Date(account.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Trading Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Daily Drawdown Limit</p>
                        <p className="font-medium text-destructive">{account.dailyDrawdownPercent}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Max Drawdown Limit</p>
                        <p className="font-medium text-destructive">{account.maxDrawdownPercent}%</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {account.profitSplitPercent && (
                        <div>
                          <p className="text-sm text-muted-foreground">Profit Split</p>
                          <p className="font-medium">{account.profitSplitPercent}% / {100 - account.profitSplitPercent}%</p>
                        </div>
                      )}
                      {account.payoutCycleDays && (
                        <div>
                          <p className="text-sm text-muted-foreground">Payout Cycle</p>
                          <p className="font-medium">Every {account.payoutCycleDays} days</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}
