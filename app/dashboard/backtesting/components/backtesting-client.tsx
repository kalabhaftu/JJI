'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BacktestCard } from './backtest-card'
import { AddBacktestDialog } from './add-backtest-dialog'
import { EditBacktestDialog } from './edit-backtest-dialog'
import { ViewBacktestDialog } from './view-backtest-dialog'
import { AnalyticsTab } from './analytics-tab'
import { BacktestTrade, BacktestStats } from '@/types/backtesting-types'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, FilterIcon, ArrowUp01Icon, BarChartIcon, Add01Icon, Alert02Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { useData } from '@/context/data-provider'
import { useBacktests } from '../hooks/use-backtests'

interface BacktestingClientProps {
  initialBacktests: BacktestTrade[]
}

export function BacktestingClient({ initialBacktests }: BacktestingClientProps) {
  const { isDemoMode } = useData()
  const { backtests, createBacktest, updateBacktest, deleteBacktest, prependBacktest, patchBacktest, removeBacktest } = useBacktests(initialBacktests, isDemoMode)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterBy, setFilterBy] = useState<'all' | 'wins' | 'losses' | 'longs' | 'shorts'>('all')
  const [editingBacktest, setEditingBacktest] = useState<BacktestTrade | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [viewingBacktest, setViewingBacktest] = useState<BacktestTrade | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const stats: BacktestStats = useMemo(() => {
    const totalBacktests = backtests.length
    const wins = backtests.filter(b => b.outcome === 'WIN')
    const losses = backtests.filter(b => b.outcome === 'LOSS')
    const breakeven = backtests.filter(b => b.outcome === 'BREAKEVEN')
    const winRate = totalBacktests > 0 ? (wins.length / totalBacktests) * 100 : 0
    const totalPnL = backtests.reduce((sum, b) => sum + (b.pnl || 0), 0)
    const averageRR = backtests.filter(b => b.riskRewardRatio).length > 0
      ? backtests.filter(b => b.riskRewardRatio).reduce((sum, b) => sum + (b.riskRewardRatio || 0), 0) / backtests.filter(b => b.riskRewardRatio).length
      : 0

    const pnls = backtests.map(b => b.pnl || 0)
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0

    return {
      totalBacktests,
      winRate: Math.round(winRate * 10) / 10,
      averageRR: Math.round(averageRR * 10) / 10,
      totalPnL: Math.round(totalPnL * 100) / 100,
      bestTrade: Math.round(bestTrade * 100) / 100,
      worstTrade: Math.round(worstTrade * 100) / 100,
      winCount: wins.length,
      lossCount: losses.length,
      breakevenCount: breakeven.length,
    }
  }, [backtests])

  const filteredBacktests = useMemo(() => {
    return backtests.filter(backtest => {
      const matchesSearch = searchTerm === '' ||
        backtest.pair?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        backtest.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        backtest.customModel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        backtest.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesFilter =
        filterBy === 'all' ||
        (filterBy === 'wins' && backtest.outcome === 'WIN') ||
        (filterBy === 'losses' && backtest.outcome === 'LOSS') ||
        (filterBy === 'longs' && backtest.direction === 'BUY') ||
        (filterBy === 'shorts' && backtest.direction === 'SELL')

      return matchesSearch && matchesFilter
    })
  }, [backtests, searchTerm, filterBy])

  const handleView = (backtest: BacktestTrade) => {
    setViewingBacktest(backtest)
    setIsViewDialogOpen(true)
  }

  const handleEdit = (backtest: BacktestTrade) => {
    setEditingBacktest(backtest)
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      if (isDemoMode) {
        removeBacktest(id)
        toast.success('Backtest deleted successfully')
        return
      }

      await deleteBacktest(id)

      toast.success('Backtest deleted successfully')
    } catch (error) {
      reportClientError(error, { operation: 'delete-backtest', route: '/dashboard/backtesting' })
      toast.error('Failed to delete backtest')
    }
  }

  return (
    <div className="w-full max-w-full py-6 px-4 sm:px-6 space-y-6">
      <Tabs defaultValue="backtests" className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <PageHeader title="Backtesting" className="gap-2" />
          </div>
          <TabsList className="grid w-full sm:w-fit grid-cols-2 flex-shrink-0">
            <TabsTrigger value="backtests" className="gap-2">
              <HugeiconsIcon icon={BarChartIcon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
              <span className="hidden sm:inline">Backtests</span>
              <span className="sm:hidden">Tests</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <HugeiconsIcon icon={ArrowUp01Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="backtests" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={2} color="currentColor" />
              <Input
                placeholder="Search by pair, model, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="gap-2">
                    <HugeiconsIcon icon={FilterIcon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
                    {filterBy === 'all' ? 'All' : filterBy === 'wins' ? 'Wins' : filterBy === 'losses' ? 'Losses' : filterBy === 'longs' ? 'Longs' : 'Shorts'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFilterBy('all')}>
                    All Backtests
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterBy('wins')}>
                    Wins Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterBy('losses')}>
                    Losses Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterBy('longs')}>
                    Longs Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterBy('shorts')}>
                    Shorts Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
                Add Backtest
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="h-24">
              <CardContent className="px-5 py-4 h-full flex flex-col justify-center gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground/80">
                    Total
                  </span>
                  <HugeiconsIcon icon={BarChartIcon} className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={2} color="currentColor" />
                </div>
                <p className="text-2xl font-bold tracking-tight">{stats.totalBacktests}</p>
              </CardContent>
            </Card>

            <Card className="h-24">
              <CardContent className="px-5 py-4 h-full flex flex-col justify-center gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground/80">
                    Win Rate
                  </span>
                  {stats.winRate >= 50 ? (
                    <HugeiconsIcon icon={ArrowUp01Icon} className="h-3.5 w-3.5 text-long/50" strokeWidth={2} color="currentColor" />
                  ) : (
                    <HugeiconsIcon icon={ArrowUp01Icon} className="h-3.5 w-3.5 text-short/50 rotate-180" strokeWidth={2} color="currentColor" />
                  )}
                </div>
                <p className="text-2xl font-bold tracking-tight">{stats.winRate}%</p>
              </CardContent>
            </Card>

            <Card className="h-24">
              <CardContent className="px-5 py-4 h-full flex flex-col justify-center gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground/80">
                    Points/Pips
                  </span>
                  {stats.totalPnL >= 0 ? (
                    <HugeiconsIcon icon={ArrowUp01Icon} className="h-3.5 w-3.5 text-long/50" strokeWidth={2} color="currentColor" />
                  ) : (
                    <HugeiconsIcon icon={ArrowUp01Icon} className="h-3.5 w-3.5 text-short/50 rotate-180" strokeWidth={2} color="currentColor" />
                  )}
                </div>
                <p className={cn("text-2xl font-bold tracking-tight", stats.totalPnL >= 0 ? "text-long" : "text-short")}>
                  {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="h-24">
              <CardContent className="px-5 py-4 h-full flex flex-col justify-center gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground/80">
                    Avg R:R
                  </span>
                  <HugeiconsIcon icon={ArrowUp01Icon} className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={2} color="currentColor" />
                </div>
                <p className="text-2xl font-bold tracking-tight">1:{stats.averageRR.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          {filteredBacktests.length === 0 ? (
            <Card className="border-dashed border-border/50 bg-card/40">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
                  <HugeiconsIcon icon={Alert02Icon} className="h-7 w-7 text-muted-foreground" strokeWidth={2} color="currentColor" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No backtests found</h3>
                <p className="mb-5 max-w-md text-sm text-muted-foreground">
                  {searchTerm || filterBy !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Start with your first replay to build a clean performance baseline before you open analytics.'}
                </p>
                {!searchTerm && filterBy === 'all' && (
                  <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                    <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
                    Add Backtest
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredBacktests.map((backtest) => (
                  <motion.div
                    key={backtest.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <BacktestCard
                      backtest={backtest}
                      onView={() => handleView(backtest)}
                      onEdit={() => handleEdit(backtest)}
                      onDelete={() => handleDelete(backtest.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab backtests={backtests} />
        </TabsContent>
      </Tabs>

      <AddBacktestDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={async (backtestData) => {
          try {
            if (isDemoMode) {
              const newBt: BacktestTrade = {
                id: `mock-bt-${Date.now()}`,
                pair: backtestData.pair || 'EURUSD',
                direction: backtestData.direction || 'BUY',
                outcome: backtestData.outcome || 'WIN',
                session: backtestData.session || 'New York',
                model: backtestData.model || 'EMA Cross',
                customModel: backtestData.customModel,
                riskRewardRatio: backtestData.riskRewardRatio || 2.0,
                riskPoints: backtestData.riskPoints || 10,
                rewardPoints: backtestData.rewardPoints || 20,
                entryPrice: backtestData.entryPrice || 1.0850,
                stopLoss: backtestData.stopLoss || 1.0840,
                takeProfit: backtestData.takeProfit || 1.0870,
                exitPrice: backtestData.exitPrice || 1.0870,
                pnl: backtestData.pnl || 200,
                images: [],
                notes: backtestData.notes,
                tags: backtestData.tags,
                dateExecuted: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              }
              prependBacktest(newBt)
              setIsAddDialogOpen(false)
              toast.success('Backtest added successfully')
              return
            }

            await createBacktest(backtestData)

            setIsAddDialogOpen(false)
            toast.success('Backtest added successfully')
          } catch (error) {
            reportClientError(error, { operation: 'create-backtest', route: '/dashboard/backtesting' })
            toast.error('Failed to create backtest')
            throw error
          }
        }}
      />

      {editingBacktest && (
        <EditBacktestDialog
          backtest={editingBacktest}
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false)
            setEditingBacktest(null)
          }}
          onSave={async (updateData) => {
            if (isDemoMode) {
              patchBacktest(editingBacktest.id, updateData)
              setIsEditDialogOpen(false)
              setEditingBacktest(null)
              toast.success('Backtest updated successfully')
              return
            }

            try {
              await updateBacktest(editingBacktest.id, updateData)
              setIsEditDialogOpen(false)
              setEditingBacktest(null)
            } catch (error) {
              reportClientError(error, { operation: 'update-backtest', route: '/dashboard/backtesting' })
              toast.error('Failed to update backtest')
              throw error
            }
          }}
        />
      )}

      {viewingBacktest && (
        <ViewBacktestDialog
          backtest={viewingBacktest}
          isOpen={isViewDialogOpen}
          onClose={() => {
            setIsViewDialogOpen(false)
            setViewingBacktest(null)
          }}
        />
      )}
    </div>
  )
}
