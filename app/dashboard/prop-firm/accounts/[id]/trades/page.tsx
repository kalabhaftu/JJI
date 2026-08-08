'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from "sonner"
import { apiRequestData } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  RefreshIcon,
  Add01Icon,
  Search01Icon,
  FilterIcon,
  TrendingUpDownIcon,
  Calendar01Icon,
  Dollar01Icon,
  BarChartIcon,
  File01Icon,
  Download01Icon,
  Tick01Icon,
  ZapIcon,
  Clock01Icon
} from '@hugeicons/core-free-icons'
import { cn } from "@/lib/utils"
import { formatTradeData } from '@/lib/trading/trade-formatting'
import { buildTradeEntryHref } from '@/app/dashboard/trades/new/trade-entry-draft'
import { AccountStatus } from "@/types/prop-firm"
import { AccountTradesPageSkeleton } from "../components/account-loading-skeletons"

interface TradeData {
  id: string
  symbol: string
  direction: 'long' | 'short'
  entryPrice: number
  exitPrice?: number
  quantity: number
  entryTime: string
  exitTime?: string
  pnl: number
  status: 'open' | 'closed'
  notes?: string
}

interface AccountData {
  id: string
  number: string
  name?: string
  propfirm: string
  status: AccountStatus
  currentEquity: number
  currentBalance: number
}

interface PhaseInfo {
  phaseNumber: number
  status: 'active' | 'archived' | 'pending'
  tradeCount: number
}

interface TradeStatistics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  breakEvenTrades: number
  winRate: number
  totalPnl: number
}

export default function AccountTradesPage() {
  const params = useParams()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('trades')
  const [phaseFilter, setPhaseFilter] = useState<string>('current')
  const accountId = params.id as string
  const scope = useQueryScope()

  const accountQuery = useQuery({
    queryKey: queryKeys.propFirmAccount(scope, accountId),
    queryFn: ({ signal }) => apiRequestData<{ account: AccountData }>(
      `/api/v1/prop-firm/accounts/${accountId}`,
      { signal, operation: 'load-prop-firm-account' },
    ),
    enabled: isScopeReady(scope) && Boolean(accountId),
    staleTime: 30_000,
  })

  const tradesQuery = useQuery({
    queryKey: queryKeys.propFirmTrades(scope, accountId, { phase: phaseFilter }),
    queryFn: ({ signal }) => apiRequestData<{ trades: TradeData[]; statistics: TradeStatistics; filter: { availablePhases: PhaseInfo[] } }>(
      `/api/v1/prop-firm/accounts/${accountId}/trades?phase=${phaseFilter}`,
      { signal, operation: 'load-prop-firm-trades' },
    ),
    enabled: isScopeReady(scope) && Boolean(accountId),
    staleTime: 30_000,
  })

  const account = accountQuery.data?.account ?? null
  const trades = tradesQuery.data?.trades ?? []
  const tradeStatistics = tradesQuery.data?.statistics ?? {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    breakEvenTrades: 0,
    winRate: 0,
    totalPnl: 0,
  }
  const availablePhases = tradesQuery.data?.filter?.availablePhases ?? []
  const isLoading = accountQuery.isLoading || tradesQuery.isLoading

  useEffect(() => {
    if (accountQuery.error) {
      toast.error('Failed to fetch account details', {
        description: 'An error occurred while fetching account details'
      })
    }
  }, [accountQuery.error])

  useEffect(() => {
    if (tradesQuery.error) {
      toast.error('Failed to fetch trades', {
        description: 'An error occurred while fetching trades'
      })
    }
  }, [tradesQuery.error])

  const formatCurrencyAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const filteredTrades = trades.filter((trade) =>
    trade.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalTrades = tradeStatistics.totalTrades
  const winningTrades = tradeStatistics.winningTrades
  const losingTrades = tradeStatistics.losingTrades
  const winRate = tradeStatistics.winRate
  const totalPnl = tradeStatistics.totalPnl

  if (isLoading) {
    return <AccountTradesPageSkeleton />
  }

  if (!account) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-12 w-12 text-muted-foreground mx-auto mb-4" strokeWidth={1.5} color="currentColor" />
            <h3 className="text-lg font-semibold mb-2">Account Not Found</h3>
            <p className="text-muted-foreground">The requested account could not be found.</p>
            <Button onClick={() => router.back()} className="mt-4">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {            }
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}`)}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Trades</h1>
            <p className="text-muted-foreground">
              {account.name || account.number} • {account.propfirm}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { void tradesQuery.refetch() }}
            disabled={isLoading}
          >
            {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <HugeiconsIcon icon={RefreshIcon} className="mr-2 h-4 w-4" strokeWidth={1.5} color="currentColor" />}
            Refresh
          </Button>
          <Button
            onClick={() => router.push(buildTradeEntryHref({ origin: 'prop-firm', propFirmAccountId: accountId, accountId: account.number, returnTo: `/dashboard/prop-firm/accounts/${accountId}/trades` }))}
            size="sm"
          >
            <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
            Add Trade
          </Button>
        </div>
      </div>

      {                       }
      {availablePhases.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Phase Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={phaseFilter === 'current' ? "primary" : "secondary"}
                size="sm"
                onClick={() => setPhaseFilter('current')}
              >
                Current Phase Only
              </Button>
              {availablePhases.map((phase: PhaseInfo) => (
                <Button
                  key={phase.phaseNumber}
                  variant={phaseFilter === phase.phaseNumber.toString() ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setPhaseFilter(phase.phaseNumber.toString())}
                >
                  Phase {phase.phaseNumber}
                  <Badge variant="secondary" className="ml-2">
                    {phase.status === 'archived' ? <HugeiconsIcon icon={Tick01Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" /> : phase.status === 'active' ? <HugeiconsIcon icon={ZapIcon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" /> : <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" />}
                    {phase.tradeCount}
                  </Badge>
                </Button>
              ))}
              <Button
                variant={phaseFilter === 'all' ? "primary" : "secondary"}
                size="sm"
                onClick={() => setPhaseFilter('all')}
              >
                All Phases
              </Button>
              <Button
                variant={phaseFilter === 'archived' ? "primary" : "secondary"}
                size="sm"
                onClick={() => setPhaseFilter('archived')}
              >
                Archived Only
              </Button>
            </div>
            {phaseFilter === 'current' && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing trades from your current active phase
              </p>
            )}
            {phaseFilter === 'all' && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing trades from all phases (current and archived)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {                    }
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            <HugeiconsIcon icon={BarChartIcon} className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTrades}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <HugeiconsIcon icon={TrendingUpDownIcon} className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {winningTrades} wins / {losingTrades} losses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            <HugeiconsIcon icon={Dollar01Icon} className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", totalPnl >= 0 ? "text-long" : "text-short")}>
              {formatCurrencyAmount(totalPnl)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Balance</CardTitle>
            <HugeiconsIcon icon={Dollar01Icon} className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyAmount(account.currentBalance)}</div>
          </CardContent>
        </Card>
      </div>

      {                       }
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} color="currentColor" />
          <Input
            placeholder="Search trades..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="secondary" size="sm">
          <HugeiconsIcon icon={FilterIcon} className="h-4 w-4 mr-2" strokeWidth={1.5} color="currentColor" />
          Filter
        </Button>
        <Button variant="secondary" size="sm">
          <HugeiconsIcon icon={Download01Icon} className="h-4 w-4 mr-2" strokeWidth={1.5} color="currentColor" />
          Export
        </Button>
      </div>

      {                  }
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="trades">All Trades</TabsTrigger>
          <TabsTrigger value="open">Open Positions</TabsTrigger>
          <TabsTrigger value="closed">Closed Trades</TabsTrigger>
        </TabsList>

        <TabsContent value="trades">
          {                 }
          {filteredTrades.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <HugeiconsIcon icon={File01Icon} className="h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} color="currentColor" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm ? 'No trades found' : 'No trades yet'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'Try a different search term' : 'Add your first trade to get started'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => router.push(buildTradeEntryHref({ origin: 'prop-firm', propFirmAccountId: accountId, accountId: account.number, returnTo: `/dashboard/prop-firm/accounts/${accountId}/trades` }))}>
                    <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
                    Add Trade
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredTrades.map((trade: TradeData) => (
                <Card key={trade.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{trade.symbol}</h3>
                          <Badge variant={trade.direction === 'long' ? 'default' : 'secondary'}>
                            {trade.direction.toUpperCase()}
                          </Badge>
                          <Badge variant={trade.status === 'open' ? 'outline' : 'default'}>
                            {trade.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Entry Price</p>
                            <p className="font-medium">{formatCurrencyAmount(trade.entryPrice)}</p>
                          </div>

                          {trade.exitPrice && (
                            <div>
                              <p className="text-xs text-muted-foreground">Exit Price</p>
                              <p className="font-medium">{formatCurrencyAmount(trade.exitPrice)}</p>
                            </div>
                          )}

                          <div>
                            <p className="text-xs text-muted-foreground">Quantity</p>
                            <p className="font-medium">{formatTradeData(trade as any).quantityWithUnit}</p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground">P&L</p>
                            <p className={cn("font-medium", trade.pnl >= 0 ? "text-long" : "text-short")}>
                              {formatCurrencyAmount(trade.pnl)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <HugeiconsIcon icon={Calendar01Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" />
                            <span>Entry: {formatDateTime(trade.entryTime)}</span>
                          </div>

                          {trade.exitTime && (
                            <div className="flex items-center gap-1">
                              <HugeiconsIcon icon={Calendar01Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" />
                              <span>Exit: {formatDateTime(trade.exitTime)}</span>
                            </div>
                          )}
                        </div>

                        {trade.notes && (
                          <div>
                            <p className="text-xs text-muted-foreground">Notes</p>
                            <p className="text-sm">{trade.notes}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/trades/${trade.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="open">
          {                    }
          {(() => {
            const openTrades = filteredTrades.filter((trade: TradeData) => trade.status === 'open')
            return openTrades.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <HugeiconsIcon icon={File01Icon} className="h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} color="currentColor" />
                  <h3 className="text-lg font-semibold mb-2">No open positions</h3>
                  <p className="text-muted-foreground">You don&apos;t have any open trades at the moment.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {openTrades.map((trade: TradeData) => (
                  <Card key={trade.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{trade.symbol}</h3>
                            <Badge variant={trade.direction === 'long' ? 'default' : 'secondary'}>
                              {trade.direction.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">Open</Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Entry Price</p>
                              <p className="font-medium">{formatCurrencyAmount(trade.entryPrice)}</p>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground">Quantity</p>
                              <p className="font-medium">{Number(trade.quantity).toFixed(2)} lots</p>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground">Unrealized P&L</p>
                              <p className={cn("font-medium", trade.pnl >= 0 ? "text-long" : "text-short")}>
                                {formatCurrencyAmount(trade.pnl)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <HugeiconsIcon icon={Calendar01Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" />
                            <span>Entry: {formatDateTime(trade.entryTime)}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/trades/${trade.id}/edit`)}
                          >
                            Close Position
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/trades/${trade.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          })()}
        </TabsContent>

        <TabsContent value="closed">
          {                   }
          {(() => {
            const closedTrades = filteredTrades.filter((trade: TradeData) => trade.status === 'closed')
            return closedTrades.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <HugeiconsIcon icon={File01Icon} className="h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} color="currentColor" />
                  <h3 className="text-lg font-semibold mb-2">No closed trades</h3>
                  <p className="text-muted-foreground">You don&apos;t have any closed trades yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {closedTrades.map((trade: TradeData) => (
                  <Card key={trade.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{trade.symbol}</h3>
                            <Badge variant={trade.direction === 'long' ? 'default' : 'secondary'}>
                              {trade.direction.toUpperCase()}
                            </Badge>
                            <Badge variant="default">Closed</Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Entry Price</p>
                              <p className="font-medium">{formatCurrencyAmount(trade.entryPrice)}</p>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground">Exit Price</p>
                              <p className="font-medium">{formatCurrencyAmount(trade.exitPrice || 0)}</p>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground">Quantity</p>
                              <p className="font-medium">{Number(trade.quantity).toFixed(2)} lots</p>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground">P&L</p>
                              <p className={cn("font-medium", trade.pnl >= 0 ? "text-long" : "text-short")}>
                                {formatCurrencyAmount(trade.pnl)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <HugeiconsIcon icon={Calendar01Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" />
                              <span>Entry: {formatDateTime(trade.entryTime)}</span>
                            </div>

                            {trade.exitTime && (
                              <div className="flex items-center gap-1">
                                <HugeiconsIcon icon={Calendar01Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" />
                                <span>Exit: {formatDateTime(trade.exitTime)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/trades/${trade.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          })()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
