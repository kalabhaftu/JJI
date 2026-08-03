'use client'

import { useState } from 'react'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  Clock,
  Hash,
  SlidersHorizontal,
  Target,
  Wallet,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { FilterBar, FilterBarGroup } from '@/components/godui/filter-bar'
import { SegmentedControl } from '@/components/godui/segmented-control'
import { Combobox } from '@/components/godui/combobox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DateRange } from '@/components/ui/custom-date-range-picker'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible'

interface ReportFiltersProps {
  accounts: any[]
  selectedAccountId: string | null
  onAccountChange: (id: string | null) => void
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  onPresetSelect: (range: string) => void
  activePreset?: string
  filters: {
    symbol: string
    session: string
    outcome: string
    strategy: string
    ruleBroken: string
  }
  options: {
    symbols: string[]
    sessions: string[]
    outcomes: { value: string; label: string }[]
    strategies: { id: string; name: string }[]
  }
  onFilterChange: (key: string, value: string) => void
}

export function ReportFilters({
  accounts,
  selectedAccountId,
  onAccountChange,
  dateRange,
  onDateRangeChange,
  onPresetSelect,
  activePreset,
  filters,
  options,
  onFilterChange,
}: ReportFiltersProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const activeFilterCount = Object.values(filters).filter((value) => value !== 'all').length

  return (
    <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
      <div className="mb-8">
        <FilterBar>
          <FilterBarGroup className="min-w-[180px] sm:max-w-[210px]">
            <Wallet className="size-3.5 shrink-0 text-muted-foreground" />
            <Combobox options={accounts.map((account) => ({ value: account.id, label: account.name }))} value={selectedAccountId || 'all'} onValueChange={(value) => onAccountChange(value === 'all' ? null : value)} placeholder="All Accounts" searchPlaceholder="Search accounts…" className="flex-1" />
          </FilterBarGroup>

          <div className="hidden h-8 w-px bg-border/12 lg:block" />

          <SegmentedControl items={['7D', '30D', '90D', 'YTD', 'ALL'].map((preset) => ({ value: preset, label: preset }))} value={activePreset} onValueChange={onPresetSelect} />

          <div className="hidden h-8 w-px bg-border/12 lg:block" />

          <FilterBarGroup className="min-w-[210px] sm:max-w-[260px]">
            <DateRangeFilter value={dateRange} onChange={onDateRangeChange} className="w-full border-0 bg-transparent px-0 text-[11px] font-bold uppercase tracking-wider shadow-none" />
          </FilterBarGroup>

          <div className="ml-auto" />

          <Button
            variant={showAdvanced ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              'h-10 gap-2 rounded-xl px-4 text-[11px] font-bold uppercase tracking-wider transition-all',
              showAdvanced
                ? 'bg-primary text-primary-foreground'
                : 'border-border/22 bg-background/55 hover:bg-muted/20'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[9px] font-black">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </FilterBar>

        <CollapsibleContent className="overflow-hidden border-b border-border/20 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="grid gap-px bg-border/12 lg:grid-cols-5">
            <FilterSelect
              icon={<Hash className="h-3 w-3" />}
              label="Symbol"
              value={filters.symbol}
              onChange={(value) => onFilterChange('symbol', value)}
              placeholder="All Symbols"
              options={options.symbols.map((symbol) => ({ value: symbol, label: symbol }))}
            />
            <FilterSelect
              icon={<Clock className="h-3 w-3" />}
              label="Session"
              value={filters.session}
              onChange={(value) => onFilterChange('session', value)}
              placeholder="All Sessions"
              options={options.sessions.map((session) => ({ value: session, label: session }))}
            />
            <FilterSelect
              icon={<CheckCircle2 className="h-3 w-3" />}
              label="Outcome"
              value={filters.outcome}
              onChange={(value) => onFilterChange('outcome', value)}
              placeholder="All Outcomes"
              options={options.outcomes}
            />
            <FilterSelect
              icon={<Target className="h-3 w-3" />}
              label="Strategy"
              value={filters.strategy}
              onChange={(value) => onFilterChange('strategy', value)}
              placeholder="All Systems"
              options={options.strategies.map((strategy) => ({ value: strategy.id, label: strategy.name }))}
            />
            <FilterSelect
              icon={<AlertCircle className="h-3 w-3" />}
              label="Rule Status"
              value={filters.ruleBroken}
              onChange={(value) => onFilterChange('ruleBroken', value)}
              placeholder="All Status"
              options={[
                { value: 'broken', label: 'Broken' },
                { value: 'followed', label: 'Followed' },
              ]}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: { value: string; label: string }[]
}) {
  return (
    <div className="bg-background/22 px-4 py-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-[0.14em]">{label}</span>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 rounded-none border-0 border-b border-border/18 bg-transparent px-0 text-[11px] font-bold uppercase tracking-wider shadow-none hover:bg-transparent focus:ring-0">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border/16">
          <SelectItem value="all" className="text-[11px] font-bold uppercase">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-[11px] font-bold uppercase">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
