'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { TradeCard } from './trade-card'
import {
  Search,
  Filter,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Tag,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  BookOpen,
  LayoutGrid,
  Calendar as CalendarIcon
} from "lucide-react"
import { Button } from '@/components/ui/button'
import { emitTourEvent } from '@/lib/tours/events'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { JournalPageSkeleton } from './journal-page-skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
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
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'
import { apiRequest } from '@/lib/api/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useData } from '@/context/data-provider'
import { useModalStateStore } from '@/store/modal-state-store'
import type { TradeType as Trade } from '@/lib/db/schema';

import { formatCurrency } from '@/lib/trading/trade-formatting'
import { groupTradesByExecution } from '@/lib/trading/trade-grouping'
import Fuse from 'fuse.js'
import { getAssetSearchTerms } from '@/lib/constants/asset-aliases'
import { useTags } from '@/context/tags-provider'
import { cn } from '@/lib/utils'
import { ensureExtendedTrade } from '@/lib/trading/trade-formatting'
import { useJournal } from '@/hooks/use-journal'
import { formatBreakevenBand, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { PageHeader } from '@/components/ui/page-header'
import { format } from 'date-fns'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { classifyOutcome } from '@/lib/metrics/outcome'

const ITEMS_PER_PAGE = 21
const TradeEditPanel = dynamic(
  () => import('@/app/dashboard/components/tables/trade-edit-panel').then((mod) => mod.TradeEditPanel),
  { ssr: false },
)
const TradeDetailPanel = dynamic(
  () => import('@/app/dashboard/components/tables/trade-detail-panel').then((mod) => mod.TradeDetailPanel),
  { ssr: false },
)
const JournalCalendar = dynamic(
  () => import('./journal-calendar').then((mod) => mod.JournalCalendar),
  { ssr: false },
)
const DailyNotePanel = dynamic(
  () => import('./daily-note-panel').then((mod) => mod.DailyNotePanel),
  { ssr: false },
)

function JournalStats({ statistics }: { statistics: any }) {
  if (!statistics) return null

  const winRate = typeof statistics.winRate === 'number' ? statistics.winRate : 0;
  const totalPnl = typeof statistics.totalPnL === 'number' ? statistics.totalPnL : (statistics.cumulativePnl || 0);
  const breakEvenThreshold = getBreakEvenThreshold(statistics.breakEvenThreshold)

  const sumSeconds = statistics.totalPositionTime || 0
  const tradeCount = statistics.nbTrades || 1
  const avgDuration = Math.floor((sumSeconds / tradeCount) / 60)

  const stats = {
      totalTrades: statistics.nbTrades || 0,
      winRate,
      totalPnl,
      avgDuration
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card className="h-24">
        <CardContent className="px-6 py-4 h-full flex flex-col justify-center gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground/80">
              Total Trades
            </span>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
          <p className="text-2xl font-bold tracking-tight">{stats.totalTrades}</p>
        </CardContent>
      </Card>

      <Card className="h-24">
        <CardContent className="px-6 py-4 h-full flex flex-col justify-center gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground/80">
              Win Rate
            </span>
            {stats.winRate >= 50 ? (
              <TrendingUp className="h-3.5 w-3.5 text-long/50" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-short/50" />
            )}
          </div>
          <p className="text-2xl font-bold tracking-tight">{stats.winRate.toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground">BE band: {formatBreakevenBand(breakEvenThreshold)}</p>
        </CardContent>
      </Card>

      <Card className="h-24">
        <CardContent className="px-6 py-4 h-full flex flex-col justify-center gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground/80">
              Total P&L
            </span>
            {stats.totalPnl >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-long/50" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-short/50" />
            )}
          </div>
          <p className={cn("text-2xl font-bold tracking-tight", stats.totalPnl >= 0 ? "text-long" : "text-short")}>
            {stats.totalPnl >= 0 ? '+' : ''}{formatCurrency(stats.totalPnl)}
          </p>
        </CardContent>
      </Card>

      <Card className="h-24">
        <CardContent className="px-6 py-4 h-full flex flex-col justify-center gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground/80">
              Avg Duration
            </span>
            <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
          <p className="text-2xl font-bold tracking-tight">{stats.avgDuration}m</p>
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyState({
  hasFilters,
  searchTerm,
  onClearFilters
}: {
  hasFilters: boolean
  searchTerm: string
  onClearFilters: () => void
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No trades found</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          {searchTerm
            ? `No trades match "${searchTerm}"`
            : hasFilters
              ? 'Try adjusting your filters'
              : 'Import trades to start journaling'
          }
        </p>
        {(hasFilters || searchTerm) && (
          <Button variant="secondary" size="sm" className="mt-4" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function JournalClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { formattedTrades, updateTrades, accountNumbers, isDemoMode } = useData()
  const { tags } = useTags()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [tradeDateFilter, setTradeDateFilter] = useState('')
  const [filterBy, setFilterBy] = useState<'all' | 'wins' | 'losses' | 'breakeven' | 'buys' | 'sells'>('all')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null)

  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid')
  const [notePanelDate, setNotePanelDate] = useState<Date | null>(null)

  const view = searchParams.get('view')
  const tradeIdParam = searchParams.get('tradeId')
  const dateParam = searchParams.get('date')

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 250)
    return () => window.clearTimeout(timeout)
  }, [searchTerm])

  const { trades: paginatedTrades, totalCount, statistics, isLoading, refetch } = useJournal({
    page: currentPage,
    search: debouncedSearchTerm,
    tradeDate: tradeDateFilter,
    filterBy,
    selectedTagIds,
    accountNumbers,
  })

  const matchedTrade = useMemo(() => {
    if (!tradeIdParam) return null
    return paginatedTrades.find((t: any) => t.id === tradeIdParam) || formattedTrades?.find((t: any) => t.id === tradeIdParam) || null
  }, [tradeIdParam, paginatedTrades, formattedTrades])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const activeBreakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterBy, selectedTagIds])

  useEffect(() => {
    if (!dateParam) return
    setSearchTerm(dateParam)
    setTradeDateFilter(dateParam)
    setViewMode('grid')
  }, [dateParam])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refetch()
      toast.success('Trades refreshed')
    } catch (error) {
      reportClientError(error, { operation: 'refresh-journal-trades', route: '/dashboard/journal' })
      toast.error('Failed to refresh', {
        description: 'Your trades may be out of date. Please try again.'
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [refetch])

  const handleEditTrade = useCallback((trade: Trade) => {
    router.push(`/dashboard/journal?view=edit&tradeId=${trade.id}`)
  }, [router])

  const handleViewTrade = useCallback((trade: Trade) => {
    router.push(`/dashboard/journal?view=details&tradeId=${trade.id}`)
  }, [router])

  const handleDeleteTrade = useCallback((trade: Trade) => {
    setTradeToDelete(trade)
    setShowDeleteDialog(true)
  }, [])

  const confirmDeleteTrade = useCallback(async () => {
    if (!tradeToDelete) return

    try {
      await apiRequest(`/api/v1/trades/${tradeToDelete.id}`, {
        method: 'DELETE',
      })
      toast.success('Trade deleted successfully')
      await refetch()
    } catch (error) {
      reportClientError(error, { operation: 'delete-journal-trade', route: '/dashboard/journal' })
      toast.error('Failed to delete trade')
    } finally {
      setShowDeleteDialog(false)
      setTradeToDelete(null)
    }
  }, [tradeToDelete, refetch])

  const handleSaveTrade = useCallback(async (updatedTrade: Partial<Trade>) => {
    if (!matchedTrade) return

    try {
      await updateTrades([matchedTrade.id], updatedTrade)
      toast.success('Trade updated successfully')

      await refetch()
    } catch (error) {
      reportClientError(error, { operation: 'update-journal-trade', route: '/dashboard/journal' })
      toast.error('Failed to update trade', {
        description: 'Your changes were not saved. Please try again.'
      })
    }
  }, [matchedTrade, updateTrades, refetch])

  const handleClearFilters = useCallback(() => {
    setSearchTerm('')
    setTradeDateFilter('')
    setFilterBy('all')
    setSelectedTagIds([])
    if (dateParam || view || tradeIdParam) {
      router.replace('/dashboard/journal')
    }
  }, [dateParam, router, tradeIdParam, view])

  const hasFilters = filterBy !== 'all' || selectedTagIds.length > 0

  if (isLoading && paginatedTrades.length === 0) {
    return <JournalPageSkeleton />
  }

  if (view === 'details' && matchedTrade) {
    return (
      <div className="w-full h-[calc(100vh-3.5rem)]">
        <TradeDetailPanel
          trade={matchedTrade as Trade}
          onClose={() => router.push('/dashboard/journal')}
          basePath="/dashboard/journal"
        />
      </div>
    )
  }

  if (view === 'edit' && matchedTrade) {
    return (
      <div className="w-full h-[calc(100vh-3.5rem)]">
        <TradeEditPanel
          trade={ensureExtendedTrade(matchedTrade as Trade)}
          onClose={() => router.push('/dashboard/journal')}
          onSave={handleSaveTrade}
        />
      </div>
    )
  }

  return (
    <div className="w-full max-w-full py-6 px-4 sm:px-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        <PageHeader
          title="Trading Journal"
          actions={
            <>
              <Button
                variant="tertiary"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                {isRefreshing ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </>
          }
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 }}
        className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl w-fit"
      >
        <Button
          variant={viewMode === 'grid' ? 'secondary' : "tertiary"}
          size="sm"
          className="h-8 gap-2 rounded-lg"
          data-tour="journal-view-cards-btn"
          onClick={() => {
            setViewMode('grid')
            emitTourEvent('journal.view.cards')
          }}
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="text-[10px] uppercase font-black tracking-widest">Cards</span>
        </Button>
        <Button
          variant={viewMode === 'calendar' ? 'secondary' : "tertiary"}
          size="sm"
          className="h-8 gap-2 rounded-lg"
          data-tour="journal-view-calendar-btn"
          onClick={() => {
            setViewMode('calendar')
            emitTourEvent('journal.view.calendar')
          }}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="text-[10px] uppercase font-black tracking-widest">Calendar</span>
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        {statistics && <JournalStats statistics={statistics} />}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            placeholder="Search by symbol, alias, or notes..."
            value={searchTerm}
            onChange={(e) => {
              const nextValue = e.target.value
              setSearchTerm(nextValue)
              const nextIsDate = /^\d{4}-\d{2}-\d{2}$/.test(nextValue.trim())
              setTradeDateFilter(nextIsDate ? nextValue.trim() : '')
            }}
            className="pl-9 pr-9 h-9"
          />
          {searchTerm && (
            <Button
              variant="tertiary"
              size="icon"
              aria-label="Clear journal search"
              title="Clear search"
              onClick={() => {
                setSearchTerm('')
                setTradeDateFilter('')
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-2 h-9 whitespace-nowrap">
              <Filter className="h-4 w-4" />
              <span>
                {filterBy === 'all'
                  ? 'All'
                  : filterBy === 'wins'
                    ? 'Wins'
                    : filterBy === 'losses'
                      ? 'Losses'
                      : filterBy === 'breakeven'
                        ? 'BE'
                        : filterBy === 'buys'
                          ? 'Buys'
                          : 'Sells'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFilterBy('all')}>
              All Trades
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterBy('wins')}>
              Wins Only ({`> +$${activeBreakEvenThreshold}`})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterBy('losses')}>
              Losses Only ({`< -$${activeBreakEvenThreshold}`})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterBy('breakeven')}>
              Break-even Only ({formatBreakevenBand(activeBreakEvenThreshold)})
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFilterBy('buys')}>
              Buys Only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterBy('sells')}>
              Sells Only
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-2 h-9 whitespace-nowrap">
              <Tag className="h-4 w-4" />
              <span>
                {selectedTagIds.length === 0 ? 'Tags' : `${selectedTagIds.length} Selected`}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Filter by Tags</span>
              {selectedTagIds.length > 0 && (
                <Button
                  variant="tertiary"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedTagIds([])
                  }}
                >
                  Clear
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tags.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                No tags created yet
              </div>
            ) : (
              tags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={selectedTagIds.includes(tag.id)}
                  onCheckedChange={(checked) => {
                    setSelectedTagIds(prev =>
                      checked
                        ? [...prev, tag.id]
                        : prev.filter(id => id !== tag.id)
                    )
                  }}
                >
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{ backgroundColor: tag.color, color: 'white', borderColor: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>

      {selectedTagIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex flex-wrap gap-2 items-center"
        >
          <span className="text-sm text-muted-foreground">Filtering by:</span>
          {selectedTagIds.map(tagId => {
            const tag = tags.find(t => t.id === tagId)
            return tag ? (
              <Badge
                key={tag.id}
                variant="secondary"
                className="gap-1 cursor-pointer"
                style={{ backgroundColor: tag.color, color: 'white', borderColor: tag.color }}
                onClick={() => setSelectedTagIds(prev => prev.filter(id => id !== tagId))}
              >
                {tag.name}
                <X className="h-3 w-3" />
              </Badge>
            ) : null
          })}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {paginatedTrades.length === 0 && !isLoading ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <EmptyState
              hasFilters={hasFilters}
              searchTerm={searchTerm}
              onClearFilters={handleClearFilters}
            />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {viewMode === 'calendar' ? (
              <JournalCalendar
                trades={formattedTrades || []}
                onDayClick={(date, dayTrades) => {
                  if (dayTrades.length === 0) {

                    setNotePanelDate(date)
                    return
                  }
                  const dateStr = format(date, 'yyyy-MM-dd')
                  setTradeDateFilter(dateStr)
                  setSearchTerm(dateStr)
                  setViewMode('grid')
                  router.push(`/dashboard/journal?date=${dateStr}`)
                }}
                onDayNoteClick={(date) => setNotePanelDate(date)}
              />
            ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedTrades.map((trade, index) => (
                <motion.div
                  key={(trade as any).id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                >
                  <TradeCard
                    trade={trade}
                    onEdit={() => handleEditTrade(trade)}
                    onView={() => handleViewTrade(trade)}
                    onDelete={() => handleDeleteTrade(trade)}
                    breakEvenThreshold={activeBreakEvenThreshold}
                  />
                </motion.div>
              ))}
            </div>

            {totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8"
              >
                <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} trades
                </div>
                <div className="flex flex-wrap justify-center items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "primary" : "secondary"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 sm:w-9 sm:h-9 p-0 text-xs sm:text-sm"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="gap-1"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}
            </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {                                                    }

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="z-[10002]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Delete Trade?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this trade ({tradeToDelete?.instrument} {tradeToDelete?.side})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false)
              setTradeToDelete(null)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTrade} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Trade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {                                                                     }

      {notePanelDate && (
        <DailyNotePanel
          date={notePanelDate}
          onClose={() => setNotePanelDate(null)}
          {...((() => {
            const dateStr = format(notePanelDate, 'yyyy-MM-dd')
            const dayTrades = (formattedTrades || []).filter((t: any) => {
              if (!t.entryDate) return false
              return t.entryDate.toString().split('T')[0] === dateStr
            })
            if (dayTrades.length === 0) return {}
            const pnl = dayTrades.reduce((sum: number, t: any) => sum + getTradeNetPnl(t), 0)
            const wins = dayTrades.filter((t: any) => classifyOutcome(getTradeNetPnl(t), activeBreakEvenThreshold) === 'win').length
            const losses = dayTrades.filter((t: any) => classifyOutcome(getTradeNetPnl(t), activeBreakEvenThreshold) === 'loss').length
            return { dailyStats: { pnl, trades: dayTrades.length, wins, losses } }
          })())}
        />
      )}
    </div>
  )
}
