'use client'

import { useMemo, useState } from 'react'
import { format, startOfYear, subMonths, subDays } from 'date-fns'
import type { DateRange } from '@/components/ui/custom-date-range-picker'

type ReportFilterKey = 'symbol' | 'session' | 'outcome' | 'strategy' | 'ruleBroken'

export type ReportAdvancedFilters = Record<ReportFilterKey, string>

export function useReportPageController() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 90),
    to: new Date(),
  })
  const [selectedTab, setSelectedTab] = useState('overview')
  const [isExporting, setIsExporting] = useState(false)
  const [activePreset, setActivePreset] = useState('90D')
  const [advancedFilters, setAdvancedFilters] = useState<ReportAdvancedFilters>({
    symbol: 'all',
    session: 'all',
    outcome: 'all',
    strategy: 'all',
    ruleBroken: 'all',
  })

  const filterArgs = useMemo(() => {
    const args: Record<string, string> = {}
    if (selectedAccountId) args.accountId = selectedAccountId
    if (dateRange?.from) args.dateFrom = dateRange.from.toISOString()
    if (dateRange?.to) args.dateTo = dateRange.to.toISOString()

    for (const [key, value] of Object.entries(advancedFilters)) {
      if (value !== 'all') args[key] = value
    }

    return args
  }, [advancedFilters, dateRange, selectedAccountId])

  const handlePresetSelect = (preset: string) => {
    const today = new Date()
    setActivePreset(preset)
    switch (preset) {
      case '7D':
        setDateRange({ from: subDays(today, 7), to: today })
        break
      case '30D':
        setDateRange({ from: subDays(today, 30), to: today })
        break
      case '90D':
        setDateRange({ from: subMonths(today, 3), to: today })
        break
      case 'YTD':
        setDateRange({ from: startOfYear(today), to: today })
        break
      case 'ALL':
        setDateRange({ from: new Date(2000, 0, 1), to: today })
        break
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    if (!Object.hasOwn(advancedFilters, key)) return
    setAdvancedFilters((previous) => ({
      ...previous,
      [key as ReportFilterKey]: value,
    }))
  }

  const periodLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
    : 'Select Period'

  return {
    selectedAccountId,
    setSelectedAccountId,
    dateRange,
    setDateRange,
    selectedTab,
    setSelectedTab,
    isExporting,
    setIsExporting,
    activePreset,
    setActivePreset,
    advancedFilters,
    filterArgs,
    periodLabel,
    handlePresetSelect,
    handleFilterChange,
  }
}
