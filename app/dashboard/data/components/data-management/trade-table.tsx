'use client'

import { Spinner } from '@/components/ui/spinner'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUserStore } from '@/store/user-store'
import type { TradeType as Trade } from '@/lib/db/schema';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowUpDown, Trash2, ChevronLeft, ChevronRight, Pencil, Loader2, X, Filter, TrendingUp, TrendingDown } from "lucide-react"
import { toast } from "sonner"
import { deleteTradesByIdsAction } from '@/server/accounts'
import { TradeEditPanel } from '@/app/dashboard/components/tables/trade-edit-panel'
import { TradeDetailPanel } from '@/app/dashboard/components/tables/trade-detail-panel'
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { formatQuantity, formatTradeData, ensureExtendedTrade, cn } from '@/lib/utils'
import { updateTradeAction } from '@/server/trades'
import { ExtendedTrade } from '@/types/trade-extended'
import { DataTradeTableSkeleton } from '../data-page-skeleton'
import { useData } from '@/context/data-provider'
import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'

type SortConfig = {
  key: keyof Trade
  direction: 'asc' | 'desc'
}

type SideFilter = 'all' | 'buy' | 'sell'
type PnlFilter = 'all' | 'wins' | 'losses'

import useSWR from 'swr'

// Custom fetcher for Data Management
const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function TradeTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useUserStore((state: any) => state.user)
  const { statistics } = useData()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  const [currentPage, setCurrentPage] = useState(1)
  const [tradesPerPage, setTradesPerPage] = useState(50)
  const { data: tradesResponse, isLoading: tradesLoading, mutate: refetchTrades } = useSWR(
    user?.id ? `/api/v1/data-management/trades?page=${currentPage}&limit=${tradesPerPage}` : null,
    fetcher,
    { keepPreviousData: true }
  )

  const formattedTrades = useMemo(() => {
    if (!tradesResponse?.data) return []
    return tradesResponse.data.map((t: any) => ensureExtendedTrade(t))
  }, [tradesResponse])

  const pagination = tradesResponse?.pagination || { total: 0, page: 1, limit: tradesPerPage, totalPages: 0 }

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'entryDate', direction: 'desc' })
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // URL-based view/edit panel state
  const activeView = searchParams.get('view') as 'details' | 'edit' | null
  const activeTradeId = searchParams.get('tradeId')
  const selectedTradeForView = useMemo(() => {
    if (activeView !== 'details' || !activeTradeId) return null
    return formattedTrades.find((t: ExtendedTrade) => t.id === activeTradeId) || null
  }, [activeView, activeTradeId, formattedTrades])
  const selectedTradeForEdit = useMemo(() => {
    if (activeView !== 'edit' || !activeTradeId) return null
    return formattedTrades.find((t: ExtendedTrade) => t.id === activeTradeId) || null
  }, [activeView, activeTradeId, formattedTrades])

  const handleClosePanel = useCallback(() => {
    router.replace('/dashboard/data?tab=trades')
  }, [router])

  // Modern Filters
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [pnlFilter, setPnlFilter] = useState<PnlFilter>('all')
  const [instrumentSearchOpen, setInstrumentSearchOpen] = useState(false)
  const [accountSearchOpen, setAccountSearchOpen] = useState(false)

  // Get unique instruments and accounts for filter options
  const availableInstruments = useMemo<string[]>(() => {
    return Array.from(new Set(formattedTrades.map((t: ExtendedTrade) => t.instrument).filter(Boolean)))
  }, [formattedTrades])

  const availableAccounts = useMemo<string[]>(() => {
    return Array.from(new Set(formattedTrades.map((t: ExtendedTrade) => t.accountNumber).filter(Boolean)))
  }, [formattedTrades])

  const totalTradesCount = pagination.total || 0
  const totalPages = pagination.totalPages || 1

  const filteredAndSortedTrades = useMemo(() => {
    // If we have server-side pagination, we should apply filters on the server.
    // However, to keep it simple and respect the "independent" request,
    // we'll treat the current page of trades as the source of truth for display.
    let list = [...formattedTrades]

    // Apply client-side filters
    if (selectedInstruments.length > 0) {
      list = list.filter(trade => selectedInstruments.includes(trade.instrument))
    }
    if (selectedAccounts.length > 0) {
      list = list.filter(trade => selectedAccounts.includes(trade.accountNumber))
    }
    if (sideFilter !== 'all') {
      list = list.filter(trade => trade.side.toLowerCase() === sideFilter)
    }
    if (pnlFilter === 'wins') {
      list = list.filter(trade => classifyOutcome(Number(trade.pnl || 0), breakEvenThreshold) === 'win')
    } else if (pnlFilter === 'losses') {
      list = list.filter(trade => classifyOutcome(Number(trade.pnl || 0), breakEvenThreshold) === 'loss')
    }

    if (sortConfig.key) {
      list.sort((a, b) => {
        const aValue = a[sortConfig.key]
        const bValue = b[sortConfig.key]
        if (aValue == null && bValue == null) return 0
        if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1
        if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return list
  }, [formattedTrades, sortConfig, selectedInstruments, selectedAccounts, sideFilter, pnlFilter, breakEvenThreshold])

  const paginatedTrades = filteredAndSortedTrades

  const handleSort = (key: keyof Trade) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleDelete = async (ids: string[]) => {
    if (ids.length === 0) return

    setIsDeleting(true)

    // Clear selection immediately for responsive UI
    setSelectedTrades(new Set())
    setSelectAll(false)

    let loadingToastId: string | number | null = null

    try {
      // Show loading toast and store the ID
      loadingToastId = toast.info("Deleting Trades", {
        description: `Deleting ${ids.length} trade(s)...`,
        duration: Infinity
      })

      await deleteTradesByIdsAction(ids)

      // Refresh trades data
      refetchTrades()

      // CRITICAL: Force router refresh to update UI everywhere
      router.refresh()

      // Dismiss loading toast before showing success
      if (loadingToastId) {
        toast.dismiss(loadingToastId)
      }

      // Show success toast
      toast.success("Trades Deleted", {
        description: `Successfully deleted ${ids.length} trade(s).`,
      })
    } catch (error) {

      // Dismiss loading toast before showing error
      if (loadingToastId) {
        toast.dismiss(loadingToastId)
      }

      toast.error("Error", {
        description: "Failed to delete trades. Please try again.",
      })
      // Refresh data even on error to ensure UI is in sync
      refetchTrades()
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedTrades(new Set())
    } else {
      const allTradeIds = new Set(filteredAndSortedTrades.map(trade => trade.id))
      setSelectedTrades(allTradeIds)
    }
    setSelectAll(!selectAll)
  }

  const toggleTradeSelection = (id: string) => {
    const newSelected = new Set(selectedTrades)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedTrades(newSelected)
    setSelectAll(newSelected.size === filteredAndSortedTrades.length)
  }

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }

  const handleSaveTrade = async (updatedTrade: Partial<Trade>) => {
    if (!selectedTradeForEdit) return

    try {
      // Update the trade with new data via direct action
      await updateTradeAction(selectedTradeForEdit.id, updatedTrade)
      refetchTrades()
      router.refresh()

      toast.success("Trade Updated", {
        description: "Trade has been successfully updated.",
      })
    } catch (error) {
      toast.error("Error", {
        description: "Failed to update trade. Please try again.",
      })
    }
  }

  const clearAllFilters = () => {
    setSelectedInstruments([])
    setSelectedAccounts([])
    setSideFilter('all')
    setPnlFilter('all')
  }

  const activeFiltersCount = [
    selectedInstruments.length > 0,
    selectedAccounts.length > 0,
    sideFilter !== 'all',
    pnlFilter !== 'all'
  ].filter(Boolean).length

  if (tradesLoading && formattedTrades.length === 0) {
    return <DataTradeTableSkeleton />
  }

  return (
    <div className="w-full space-y-4">
      {/* Modern Filter Panel */}
      <div className="space-y-4">
        {/* Quick Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5">
                {activeFiltersCount}
              </Badge>
            )}
          </div>

          {/* Side Filter */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant={sideFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSideFilter('all')}
              className="h-7 px-3"
            >
              All Sides
            </Button>
            <Button
              variant={sideFilter === 'buy' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSideFilter('buy')}
              className="h-7 px-3"
            >
              Buy
            </Button>
            <Button
              variant={sideFilter === 'sell' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSideFilter('sell')}
              className="h-7 px-3"
            >
              Sell
            </Button>
          </div>

          {/* PnL Filter */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant={pnlFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPnlFilter('all')}
              className="h-7 px-3"
            >
              All
            </Button>
            <Button
              variant={pnlFilter === 'wins' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPnlFilter('wins')}
              className="h-7 px-3 text-long"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              Wins
            </Button>
            <Button
              variant={pnlFilter === 'losses' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPnlFilter('losses')}
              className="h-7 px-3 text-short"
            >
              <TrendingDown className="h-3 w-3 mr-1" />
              Losses
            </Button>
          </div>

          {/* Instrument Filter */}
          <Popover open={instrumentSearchOpen} onOpenChange={setInstrumentSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-dashed">
                Instruments
                {selectedInstruments.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {selectedInstruments.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(18rem,calc(100vw-1rem))] p-0" align="start" side="bottom">
              <Command>
                <CommandInput placeholder="Search instruments..." />
                <CommandEmpty>No instruments found.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {availableInstruments.map((instrument) => (
                    <CommandItem
                      key={instrument}
                      onSelect={() => {
                        setSelectedInstruments(prev =>
                          prev.includes(instrument)
                            ? prev.filter(i => i !== instrument)
                            : [...prev, instrument]
                        )
                      }}
                    >
                      <Checkbox
                        checked={selectedInstruments.includes(instrument)}
                        className="mr-2"
                      />
                      {instrument}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Account Filter */}
          <Popover open={accountSearchOpen} onOpenChange={setAccountSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-dashed">
                Accounts
                {selectedAccounts.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {selectedAccounts.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(20rem,calc(100vw-1rem))] p-0" align="start" side="bottom">
              <Command>
                <CommandInput placeholder="Search accounts..." />
                <CommandEmpty>No accounts found.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {availableAccounts.map((account) => (
                    <CommandItem
                      key={account}
                      onSelect={() => {
                        setSelectedAccounts(prev =>
                          prev.includes(account)
                            ? prev.filter(a => a !== account)
                            : [...prev, account]
                        )
                      }}
                    >
                      <Checkbox
                        checked={selectedAccounts.includes(account)}
                        className="mr-2"
                      />
                      {account}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-9"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}

          <div className="flex-1" />

          <div className="text-sm text-muted-foreground">
            {filteredAndSortedTrades.length} of {formattedTrades.length} trades
          </div>

          {selectedTrades.size > 0 && (
            <Button
              onClick={() => handleDelete(Array.from(selectedTrades))}
              disabled={isDeleting}
              variant="destructive"
              size="sm"
            >
              {isDeleting ? <Spinner className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {isDeleting ? 'Deleting...' : `Delete (${selectedTrades.size})`}
            </Button>
          )}
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedInstruments.map(instrument => (
              <Badge key={instrument} variant="secondary" className="gap-1">
                {instrument}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={() => setSelectedInstruments(prev => prev.filter(i => i !== instrument))}
                />
              </Badge>
            ))}
            {selectedAccounts.map(account => (
              <Badge key={account} variant="secondary" className="gap-1">
                {account}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={() => setSelectedAccounts(prev => prev.filter(a => a !== account))}
                />
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-md border overflow-auto shadow-sm">
        <Table className="w-full" style={{ minWidth: '1000px' }}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-[100px]">
                <Button variant="ghost" onClick={() => handleSort('instrument')}>
                  Instrument
                  {sortConfig.key === 'instrument' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('accountNumber')}>
                  Account
                  {sortConfig.key === 'accountNumber' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('side')}>
                  Side
                  {sortConfig.key === 'side' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('quantity')}>
                  Quantity
                  {sortConfig.key === 'quantity' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('entryPrice')}>
                  Entry Price
                  {sortConfig.key === 'entryPrice' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('closePrice')}>
                  Close Price
                  {sortConfig.key === 'closePrice' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('entryDate')}>
                  Entry Date
                  {sortConfig.key === 'entryDate' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('closeDate')}>
                  Close Date
                  {sortConfig.key === 'closeDate' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('pnl')}>
                  PNL
                  {sortConfig.key === 'pnl' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-[400px] text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="rounded-full bg-muted/30 p-6">
                      {activeFiltersCount > 0 ? (
                        <Filter className="h-10 w-10 text-muted-foreground" />
                      ) : (
                        <TrendingUp className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg tracking-tight">
                        {activeFiltersCount > 0 ? "No matching trades" : "No trades yet"}
                      </h3>
                      <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                        {activeFiltersCount > 0
                          ? "Try adjusting your filters or search terms to find what you're looking for."
                          : "Import your trading history to start analyzing your performance."}
                      </p>
                    </div>
                    {activeFiltersCount > 0 && (
                      <Button variant="outline" onClick={clearAllFilters} className="mt-2">
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedTrades.map((trade) => {
                const formatted = formatTradeData(trade)
                return (
                  <TableRow key={trade.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedTrades.has(trade.id)}
                        onCheckedChange={() => toggleTradeSelection(trade.id)}
                      />
                    </TableCell>
                    <TableCell>{formatted.instrument}</TableCell>
                    <TableCell>{formatted.accountNumber}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                          formatted.side === 'BUY' || formatted.side === 'LONG' || formatted.side === 'B'
                            ? "bg-long/10 text-long border-long/20"
                            : "bg-short/10 text-short border-short/20"
                        )}
                      >
                        {formatted.side}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatted.quantity}</TableCell>
                    <TableCell>{formatted.entryPrice}</TableCell>
                    <TableCell>{formatted.closePrice}</TableCell>
                    <TableCell>{formatted.entryDateFormatted}</TableCell>
                    <TableCell>{formatted.closeDateFormatted}</TableCell>
                    <TableCell>{formatted.pnlFormatted}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/data?tab=trades&view=details&tradeId=${trade.id}`)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/data?tab=trades&view=edit&tradeId=${trade.id}`)}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <p className="text-sm text-muted-foreground">
            Showing {totalTradesCount > 0 ? ((currentPage - 1) * tradesPerPage) + 1 : 0} to {Math.min(currentPage * tradesPerPage, totalTradesCount)} of {totalTradesCount} trades
          </p>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Show:</span>
            <Select
              value={String(tradesPerPage)}
              onValueChange={(value) => {
                setTradesPerPage(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[100px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Trade Detail View Panel (URL-based) */}
      {activeView === 'details' && selectedTradeForView && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="w-full h-screen overflow-hidden">
            <TradeDetailPanel
              trade={selectedTradeForView}
              onClose={handleClosePanel}
              basePath="/dashboard/data"
            />
          </div>
        </div>
      )}

      {/* Enhanced Edit Trade Panel (URL-based) */}
      {activeView === 'edit' && selectedTradeForEdit && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="w-full h-screen overflow-hidden">
            <TradeEditPanel
              trade={ensureExtendedTrade(selectedTradeForEdit)}
              onClose={handleClosePanel}
              onSave={handleSaveTrade}
            />
          </div>
        </div>
      )}
    </div>
  )
}
