"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { Search, Filter, Calendar, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"
import { cn } from "@/lib/utils"
import { useData } from "@/context/data-provider"
import { toast } from "sonner"
import { CustomDateRangePicker } from "@/components/ui/custom-date-range-picker"

type FilterView = 'menu' | 'instrument' | 'date'

interface CombinedFiltersProps {
  onSave?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  renderTrigger?: boolean
}

const DATE_PRESETS = [
  {
    label: "Today",
    getValue: () => ({
      from: new Date(),
      to: new Date()
    })
  },
  {
    label: "Yesterday",
    getValue: () => ({
      from: subDays(new Date(), 1),
      to: subDays(new Date(), 1)
    })
  },
  {
    label: "Last 7 days",
    getValue: () => ({
      from: subDays(new Date(), 6),
      to: new Date()
    })
  },
  {
    label: "Last 30 days",
    getValue: () => ({
      from: subDays(new Date(), 29),
      to: new Date()
    })
  },
  {
    label: "This month",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date())
    })
  },
  {
    label: "Last month",
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth)
      }
    }
  },
  {
    label: "This year",
    getValue: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date())
    })
  },
  {
    label: "All time",
    getValue: () => ({
      from: undefined,
      to: undefined
    })
  }
]

export function CombinedFilters({
  onSave,
  open: controlledOpen,
  onOpenChange,
  renderTrigger = true,
}: CombinedFiltersProps) {
  const { formattedTrades, instruments, setInstruments, dateRange, setDateRange } = useData()
  const [currentView, setCurrentView] = useState<FilterView>('menu')
  const [internalOpen, setInternalOpen] = useState(false)


  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsOpen = onOpenChange || setInternalOpen


  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")


  const [startDate, setStartDate] = useState<Date | null>(dateRange?.from || null)
  const [endDate, setEndDate] = useState<Date | null>(dateRange?.to || null)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)


  useEffect(() => {
    setSelectedInstruments(instruments || [])
  }, [instruments])

  useEffect(() => {
    if (dateRange) {
      setStartDate(dateRange.from || null)
      setEndDate(dateRange.to || null)
    } else {
      setStartDate(null)
      setEndDate(null)
    }
  }, [dateRange])


  useEffect(() => {
    if (!isOpen) {
      setCurrentView('menu')
    }
  }, [isOpen])


  const availableInstruments = useMemo(() => {
    const instrumentSet = new Set<string>()
    if (formattedTrades && Array.isArray(formattedTrades)) {
      formattedTrades.forEach(trade => {
        if (trade.symbol) instrumentSet.add(trade.symbol)
        else if (trade.instrument) instrumentSet.add(trade.instrument)
      })
    }
    return Array.from(instrumentSet).sort()
  }, [formattedTrades])


  const instrumentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (formattedTrades && Array.isArray(formattedTrades)) {
      formattedTrades.forEach(trade => {
        const inst = trade.instrument || trade.symbol
        if (inst) {
          counts[inst] = (counts[inst] || 0) + 1
        }
      })
    }
    return counts
  }, [formattedTrades])


  const filteredInstruments = useMemo(() => {
    if (!searchQuery) return availableInstruments
    const query = searchQuery.toLowerCase()
    return availableInstruments.filter(inst => inst.toLowerCase().includes(query))
  }, [availableInstruments, searchQuery])


  const handleToggleInstrument = (instrument: string) => {
    setSelectedInstruments(prev =>
      prev.includes(instrument)
        ? prev.filter(i => i !== instrument)
        : [...prev, instrument]
    )
  }

  const handleSelectAll = () => {
    setSelectedInstruments(availableInstruments)
  }

  const handleClearAll = () => {
    setSelectedInstruments([])
  }

  const handleApplyInstruments = () => {
    setInstruments(selectedInstruments)

    if (selectedInstruments.length === 0) {
      toast.success("Showing all instruments")
    } else {
      toast.success(
        `Filtering ${selectedInstruments.length} instrument${selectedInstruments.length > 1 ? 's' : ''}`
      )
    }

    onSave?.()
  }

  const handleClearInstruments = () => {
    setSelectedInstruments([])
    setInstruments([])
    toast.success("Instrument filter cleared")
    onSave?.()
  }


  const handlePresetClick = (preset: typeof DATE_PRESETS[0]) => {
    const range = preset.getValue()
    setStartDate(range.from || null)
    setEndDate(range.to || null)


    const newRange = range.from && range.to ? { from: range.from, to: range.to } : undefined
    setDateRange(newRange)

    if (!range.from && !range.to) {
      toast.success("Showing all dates")
    } else if (range.from && range.to) {
      toast.success(
        `Date range: ${format(range.from, 'MMM d, yyyy')} - ${format(range.to, 'MMM d, yyyy')}`
      )
    }

    onSave?.()
  }

  const handleApplyDate = () => {
    const newRange = startDate && endDate ? { from: startDate, to: endDate } : undefined
    setDateRange(newRange)
    setIsDatePickerOpen(false)

    if (!startDate && !endDate) {
      toast.success("Showing all dates")
    } else if (startDate && endDate) {
      toast.success(
        `Date range: ${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`
      )
    } else if (startDate) {
      toast.success(`Starting from: ${format(startDate, 'MMM d, yyyy')}`)
    }

    onSave?.()
  }

  const handleClearDate = () => {
    setStartDate(null)
    setEndDate(null)
    setDateRange(undefined)
    toast.success("Date filter cleared")
    onSave?.()
  }

  const totalInstruments = availableInstruments.length
  const displayedCount = selectedInstruments.length === 0 ? totalInstruments : selectedInstruments.length

  const renderMenuView = () => (
    <div className="w-full min-w-72 sm:min-w-96 max-w-sm sm:max-w-md p-3 sm:p-4 space-y-2">
      <div className="space-y-1 sm:space-y-2">
        <h4 className="font-semibold text-sm sm:text-base">Filters</h4>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Select a filter type to configure
        </p>
      </div>

      <Separator />

      <div className="space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start h-auto py-3 px-3 hover:bg-muted/50 transition-colors"
          onClick={() => setCurrentView('instrument')}
        >
          <div className="flex items-center gap-3 w-full">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">Instrument Filter</div>
              <div className="text-xs text-muted-foreground">
                {displayedCount === totalInstruments
                  ? `All ${totalInstruments} instruments`
                  : `${displayedCount} of ${totalInstruments} selected`}
              </div>
            </div>
          </div>
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start h-auto py-3 px-3 hover:bg-muted/50 transition-colors"
          onClick={() => setCurrentView('date')}
        >
          <div className="flex items-center gap-3 w-full">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">Date Range Filter</div>
              <div className="text-xs text-muted-foreground">
                {startDate && endDate
                  ? `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`
                  : startDate
                    ? `From ${format(startDate, 'MMM d, yyyy')}`
                    : "All time"}
              </div>
            </div>
          </div>
        </Button>
      </div>
    </div>
  )

  const renderInstrumentView = () => (
    <div className="w-full min-w-72 sm:min-w-96 max-w-sm sm:max-w-md p-3 sm:p-4 space-y-2 sm:space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setCurrentView('menu')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h4 className="font-semibold text-sm sm:text-base">Instrument Filter</h4>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Filter trades by instruments or symbols
          </p>
        </div>
      </div>

      {}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search instruments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-8 sm:h-9 text-sm"
        />
      </div>

      {}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          disabled={selectedInstruments.length === totalInstruments && totalInstruments > 0}
          className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
        >
          All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          disabled={selectedInstruments.length === 0}
          className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
        >
          None
        </Button>
      </div>

      <Separator />

      {}
      <ScrollArea className="h-48 sm:h-72 pr-3">
        {totalInstruments === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
            <Filter className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground/30 mb-2 sm:mb-3" />
            <p className="text-xs sm:text-sm text-muted-foreground">No instruments available</p>
            <p className="text-xs text-muted-foreground mt-1">Import trades to see instruments</p>
          </div>
        ) : filteredInstruments.length > 0 ? (
          <div className="space-y-1.5">
            {filteredInstruments.map((instrument) => {
              const tradeCount = instrumentCounts[instrument] || 0

              return (
                <div key={instrument} className="flex items-center gap-2 py-1">
                  <Checkbox
                    id={`instrument-${instrument}`}
                    checked={selectedInstruments.includes(instrument)}
                    onCheckedChange={() => handleToggleInstrument(instrument)}
                  />
                  <Label
                    htmlFor={`instrument-${instrument}`}
                    className="flex-1 text-xs sm:text-sm cursor-pointer flex items-center justify-between"
                  >
                    <span className="font-medium truncate">{instrument}</span>
                    <Badge variant="secondary" className="text-xs h-4 sm:h-5 px-1.5 sm:px-2">
                      {tradeCount}
                    </Badge>
                  </Label>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
            No instruments match &quot;{searchQuery}&quot;
          </div>
        )}
      </ScrollArea>

      <Separator />

      {}
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-muted-foreground">
            {selectedInstruments.length === 0
              ? `All ${totalInstruments} instruments`
              : `${selectedInstruments.length} of ${totalInstruments} instruments`}
          </span>
          {selectedInstruments.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 text-xs px-2"
            >
              Reset
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClearInstruments}
            disabled={totalInstruments === 0}
            className="flex-1 h-7 sm:h-8 text-xs sm:text-sm"
          >
            Clear
          </Button>
          <Button
            onClick={handleApplyInstruments}
            disabled={totalInstruments === 0}
            className="flex-1 h-7 sm:h-8 text-xs sm:text-sm"
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  )

  const renderDateView = () => (
    <div className="w-full min-w-72 sm:min-w-80 max-w-sm sm:max-w-md p-3 sm:p-4 space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setCurrentView('menu')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h4 className="font-semibold text-sm sm:text-base">Date Range Filter</h4>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Filter trades by date range
          </p>
        </div>
      </div>

      {}
      <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
        {DATE_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="ghost"
            size="sm"
            onClick={() => handlePresetClick(preset)}
            className={cn(
              "justify-start text-xs h-8 sm:h-9 font-normal",
              !startDate && !endDate && preset.label === "All time" && "bg-accent font-medium"
            )}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <Separator />

      {}
      <div className="flex flex-col gap-2">
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal h-10 sm:h-11 text-sm border-border bg-background hover:bg-muted/50 transition-colors"
            >
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">
                {startDate && endDate
                  ? `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`
                  : startDate
                    ? `From ${format(startDate, 'MMM d, yyyy')}`
                    : "Select date range"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CustomDateRangePicker
              selected={{ from: startDate || undefined, to: endDate || undefined }}
              onSelect={(range) => {
                if (range) {
                  setStartDate(range.from || null)
                  setEndDate(range.to || null)


                  if (range.from && range.to) {
                    const newRange = { from: range.from, to: range.to }
                    setDateRange(newRange)
                    toast.success(
                      `Date range: ${format(range.from, 'MMM d, yyyy')} - ${format(range.to, 'MMM d, yyyy')}`
                    )
                    setIsDatePickerOpen(false)
                    onSave?.()
                  }
                } else {
                  setStartDate(null)
                  setEndDate(null)
                  setDateRange(undefined)
                }
              }}
              className="w-fit"
            />
          </PopoverContent>
        </Popover>
      </div>

      <Separator />

      {}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearDate}
          className="flex-1 h-8 sm:h-9 text-sm"
        >
          Clear
        </Button>
        <Button
          size="sm"
          onClick={handleApplyDate}
          className="flex-1 h-8 sm:h-9 text-sm"
        >
          Apply
        </Button>
      </div>
    </div>
  )

  const content = (
    <>
      {currentView === 'menu' && renderMenuView()}
      {currentView === 'instrument' && renderInstrumentView()}
      {currentView === 'date' && renderDateView()}
    </>
  )

  if (!renderTrigger) {
    return <div className="w-full">{content}</div>
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="nav"
          size="navIcon"
          className="relative"
          title="Filters"
          aria-label="Filters"
        >
          <Filter aria-hidden />
          {(instruments.length > 0 || (dateRange?.from && dateRange?.to)) && (
            <Badge variant="secondary" className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] leading-none">
              {instruments.length > 0
                ? instruments.length
                : (dateRange?.from && dateRange?.to)
                  ? 'Date'
                  : ''}
              {(dateRange?.from && dateRange?.to) && instruments.length > 0 && '+'}
            </Badge>
          )}
          <span className="sr-only">Filters</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(24rem,calc(100vw-1rem))] p-0 sm:w-auto sm:max-w-[95vw] flex flex-col overflow-hidden max-h-[85dvh]"
        align="end"
        side="bottom"
        sideOffset={4}
        collisionPadding={16}
        avoidCollisions={true}
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}
