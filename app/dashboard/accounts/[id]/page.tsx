'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  RefreshCw,
  Settings as SettingsIcon,
  DollarSign,
  Activity,
  TrendingUp,
  Building2,
  Plus,
  Minus,
  Calendar,
  BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"
import { EditLiveAccountDialog } from "@/components/edit-live-account-dialog"
import { TransactionDialog } from "@/app/dashboard/components/accounts/transaction-dialog"
import { TransactionHistory } from "@/app/dashboard/components/accounts/transaction-history"
import { useUserStore } from '@/store/user-store'
import { useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import { LiveAccountDetailSkeleton } from '../components/live-account-detail-skeleton'
import { useData } from '@/context/data-provider'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { TradeDurationChart } from '@/app/dashboard/reports/components/trade-duration-chart'
import { InstrumentBreakdown } from '@/app/dashboard/reports/components/instrument-breakdown'
import { CommissionAnalysis } from '@/app/dashboard/reports/components/commission-analysis'
import { format } from 'date-fns'

interface LiveAccountData {
  id: string
  number: string
  name?: string
  broker?: string
  displayName: string
  startingBalance: number
  currentEquity?: number
  status: string
  accountType: 'live'
  tradeCount: number
  profitLoss?: number
  lastTradeDate?: string
  createdAt: string
}

function AccountTradesTab({ accountNumber, trades }: { accountNumber: string; trades: any[] }) {
  const accountTrades = useMemo(() => {
    return trades
      .filter((t: any) => t.accountNumber === accountNumber)
      .sort((a: any, b: any) => {
        const dateA = new Date(a.closeDate || a.entryDate || 0).getTime()
        const dateB = new Date(b.closeDate || b.entryDate || 0).getTime()
        return dateB - dateA
      })
  }, [trades, accountNumber])

  if (accountTrades.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-1">No Trades Yet</h3>
          <p className="text-sm text-muted-foreground">Import trades to see them here</p>
        </CardContent>
      </Card>
    )
  }

  const totalPnl = accountTrades.reduce((s: number, t: any) => s + getTradeNetPnl(t), 0)
  const wins = accountTrades.filter((t: any) => getTradeNetPnl(t) > 0).length
  const winRate = accountTrades.length > 0 ? (wins / accountTrades.length) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[9px] uppercase font-bold text-muted-foreground/50 tracking-widest">Total Trades</p>
          <p className="text-xl font-black font-mono mt-1">{accountTrades.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[9px] uppercase font-bold text-muted-foreground/50 tracking-widest">Net P&L</p>
          <p className={cn("text-xl font-black font-mono mt-1", totalPnl >= 0 ? "text-long" : "text-short")}>
            {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[9px] uppercase font-bold text-muted-foreground/50 tracking-widest">Win Rate</p>
          <p className="text-xl font-black font-mono mt-1">{winRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Trade Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Instrument</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Side</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">P&L</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Commission</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Net</th>
                </tr>
              </thead>
              <tbody>
                {accountTrades.slice(0, 50).map((trade: any, i: number) => {
                  const netPnl = getTradeNetPnl(trade)
                  const tradeDate = trade.closeDate || trade.entryDate
                  return (
                    <tr key={trade.id || i} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                        {tradeDate ? format(new Date(tradeDate), 'MMM dd, yyyy') : '-'}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-xs">{trade.instrument || trade.symbol || '-'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", trade.side === 'LONG' || trade.side === 'BUY' ? "bg-long/10 text-long" : "bg-short/10 text-short")}>
                          {trade.side || '-'}
                        </span>
                      </td>
                      <td className={cn("px-4 py-2.5 text-right font-mono text-xs font-bold", (trade.pnl || 0) >= 0 ? "text-long" : "text-short")}>
                        {(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                        {Math.abs(trade.commission || 0).toFixed(2)}
                      </td>
                      <td className={cn("px-4 py-2.5 text-right font-mono text-xs font-bold", netPnl >= 0 ? "text-long" : "text-short")}>
                        {netPnl >= 0 ? '+' : ''}{netPnl.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {accountTrades.length > 50 && (
            <div className="px-4 py-3 text-center text-xs text-muted-foreground border-t">
              Showing 50 of {accountTrades.length} trades
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AccountAnalyticsTab({ accountNumber, trades }: { accountNumber: string; trades: any[] }) {
  const accountTrades = useMemo(() => {
    return trades.filter((t: any) => t.accountNumber === accountNumber)
  }, [trades, accountNumber])

  if (accountTrades.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-1">No Data Yet</h3>
          <p className="text-sm text-muted-foreground">Import trades to see analytics</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <TradeDurationChart trades={accountTrades} />
      <InstrumentBreakdown trades={accountTrades} />
      <CommissionAnalysis trades={accountTrades} />
    </div>
  )
}

export default function LiveAccountDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [account, setAccount] = useState<LiveAccountData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [refreshKey, setRefreshKey] = useState(0)

  const accountId = params.id as string
  const user = useUserStore(state => state.user)
  const { formattedTrades } = useData()
  const storeAccounts = useUserStore(state => state.accounts)

  // Fetch account data with calculated metrics
  const fetchAccountData = useCallback(async () => {
    try {
      setIsLoading(true)
      // Fetch account details with calculated metrics from enhanced endpoint
      const response = await fetch(`/api/v1/accounts/${accountId}?t=${Date.now()}`, {
        cache: 'no-store'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch account')
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch account data')
      }

      const accountData = data.data

      if (!accountData || accountData.accountType !== 'live') {
        router.push('/dashboard/accounts')
        return
      }

      setAccount(accountData)
    } catch (error) {
      router.push('/dashboard/accounts')
    } finally {
      setIsLoading(false)
    }
  }, [accountId, router])

  // Listen to store updates for this account
  useEffect(() => {
    if (!storeAccounts || !accountId) return

    const storeAccount = storeAccounts.find(acc => acc.id === accountId)
    if (storeAccount && storeAccount.accountType === 'live') {
      // Update account data from store
      setAccount(prev => {
        if (!prev) return null
        return {
          ...prev,
          name: storeAccount.name || prev.name || "",
          broker: storeAccount.broker || prev.broker || "",
          displayName: (storeAccount as any).displayName || storeAccount.name || storeAccount.number || "",
          startingBalance: storeAccount.startingBalance ?? prev.startingBalance ?? 0,
          status: storeAccount.status || 'active',
        } as LiveAccountData
      })
    }
  }, [storeAccounts, accountId])

  // Subscribe to realtime changes for this account
  useDatabaseRealtime({
    userId: user?.id,
    enabled: !!user?.id && !!accountId,
    onAccountChange: (change) => {
      const changedAccountId = (change.newRecord?.id || change.oldRecord?.id) as string | undefined
      if (changedAccountId === accountId) {
        // Refresh account data immediately
        fetchAccountData()
      }
    },
    onAnyChange: (change) => {
      // Also refresh on trade changes that might affect account metrics
      if (change.table === 'Trade') {
        const tradeAccountNumber = (change.newRecord?.accountNumber || change.oldRecord?.accountNumber) as string | undefined
        if (account && tradeAccountNumber === account.number) {
          fetchAccountData()
        }
      }
    }
  })

  useEffect(() => {
    if (accountId) {
      fetchAccountData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, refreshKey])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  if (isLoading) {
    return <LiveAccountDetailSkeleton />
  }

  if (!account) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Account Not Found</h1>
          <Button onClick={() => router.push('/dashboard/accounts')}>
            Return to Accounts
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/accounts')}
              className="w-fit"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={
                account.status === 'active' ? 'outline' :
                  account.status === 'funded' ? 'default' :
                    account.status === 'failed' ? 'destructive' : 'secondary'
              } className="text-xs">
                {account.status?.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground hidden sm:inline">•</span>
              <span className="text-sm text-muted-foreground">{account.broker || 'Live Account'}</span>
              <span className="text-sm text-muted-foreground hidden sm:inline">•</span>
              <span className="text-xs sm:text-sm text-muted-foreground truncate">
                ID: {account.id}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshKey(prev => prev + 1)
                fetchAccountData()
              }}
              className="w-fit"
            >
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
              className="w-fit"
            >
              <SettingsIcon className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Account Number</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{account.number}</div>
            </CardContent>
          </Card>
 
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Starting Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(account.startingBalance)}</div>
            </CardContent>
          </Card>
 
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Equity</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                (account.currentEquity || 0) >= account.startingBalance ? "text-long" : "text-short"
              )}>
                {formatCurrency(account.currentEquity || account.startingBalance)}
              </div>
            </CardContent>
          </Card>
 
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{account.tradeCount}</div>
            </CardContent>
          </Card>
 
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net P&L</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                (account.profitLoss || 0) >= 0 ? "text-long" : "text-short"
              )}>
                {formatCurrency(account.profitLoss || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Account Type</label>
                      <p className="text-sm font-semibold">Live Account</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Broker</label>
                      <p className="text-sm font-semibold">{account.broker || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Created</label>
                      <p className="text-sm font-semibold">
                        {new Date(account.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Trade</label>
                      <p className="text-sm font-semibold">
                        {account.lastTradeDate ?
                          new Date(account.lastTradeDate).toLocaleDateString() :
                          'No trades yet'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Account Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <TransactionDialog
                      accountId={account.id}
                      accountNumber={account.number}
                      currentBalance={account.currentEquity || 0}
                      onTransactionComplete={() => {
                        // Refresh account data by incrementing refresh key
                        setRefreshKey(prev => prev + 1)
                      }}
                    >
                      <Button className="w-full bg-long hover:bg-long/90 text-long-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Deposit
                      </Button>
                    </TransactionDialog>
 
                    <TransactionDialog
                      accountId={account.id}
                      accountNumber={account.number}
                      currentBalance={account.currentEquity || 0}
                      onTransactionComplete={() => {
                        // Refresh account data by incrementing refresh key
                        setRefreshKey(prev => prev + 1)
                      }}
                    >
                      <Button variant="outline" className="w-full border-short/20 text-short hover:bg-short/10">
                        <Minus className="w-4 h-4 mr-2" />
                        Withdraw
                      </Button>
                    </TransactionDialog>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      <strong>Deposit:</strong> Minimum $5.00<br />
                      <strong>Withdrawal:</strong> Minimum $10.00
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <TransactionHistory accountId={account.id} key={refreshKey} />
            </div>
          </TabsContent>

          <TabsContent value="trades">
            <AccountTradesTab accountNumber={account.number} trades={formattedTrades || []} />
          </TabsContent>

          <TabsContent value="analytics">
            <AccountAnalyticsTab accountNumber={account.number} trades={formattedTrades || []} />
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Account ID</label>
                      <p className="text-sm font-mono font-semibold mt-1">{account.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Account Number</label>
                      <p className="text-sm font-mono font-semibold mt-1">{account.number}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                    <SettingsIcon className="h-4 w-4 mr-2" /> Edit Account Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Account Dialog */}
      <EditLiveAccountDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        account={account}
        onSuccess={() => {
          // Refresh account data automatically via realtime, but also trigger immediate fetch
          fetchAccountData()
        }}
      />
    </div>
  )
}

