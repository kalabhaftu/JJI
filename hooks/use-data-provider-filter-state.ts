'use client'

import { useMemo, useState } from 'react'
import { type TradeFilters } from '@/hooks/use-filtered-trades'
import { isDemoSurface } from '@/lib/public-surface-routing'

export interface DataProviderDateRange {
  from: Date
  to: Date
}

export interface DataProviderPnlRange {
  min: number | undefined
  max: number | undefined
}

export interface DataProviderTimeRange {
  range: string | null
}

export interface DataProviderWeekdayFilter {
  day: number | null
}

export interface DataProviderHourFilter {
  hour: number | null
}

export function useDataProviderFilterState(timezone: string | undefined) {
  const [instruments, setInstruments] = useState<string[]>([])


  const [accountNumbers, setAccountNumbers] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const key = isDemoSurface(window.location.hostname, window.location.pathname) ? 'settings-cache-demo' : 'settings-cache'
      const cached = localStorage.getItem(key)
      if (cached) {
        const parsed = JSON.parse(cached)
        const ids = parsed?.selectedPhaseAccountIds
        if (Array.isArray(ids) && ids.length > 0) return ids
      }
    } catch {
      return []
    }
    return []
  })
  const [dateRange, setDateRange] = useState<DataProviderDateRange | undefined>(undefined)
  const [pnlRange, setPnlRange] = useState<DataProviderPnlRange>({ min: undefined, max: undefined })
  const [timeRange, setTimeRange] = useState<DataProviderTimeRange>({ range: null })
  const [weekdayFilter, setWeekdayFilter] = useState<DataProviderWeekdayFilter>({ day: null })
  const [hourFilter, setHourFilter] = useState<DataProviderHourFilter>({ hour: null })

  const tradeFilters: TradeFilters = useMemo(() => ({
    ...(accountNumbers.length > 0 && { accounts: accountNumbers }),
    ...(dateRange?.from && { dateFrom: dateRange.from.toISOString() }),
    ...(dateRange?.to && { dateTo: dateRange.to.toISOString() }),
    ...(instruments.length > 0 && { instruments }),
    ...(pnlRange.min !== undefined && { pnlMin: pnlRange.min }),
    ...(pnlRange.max !== undefined && { pnlMax: pnlRange.max }),
    ...(timeRange.range !== null && { timeRange: timeRange.range }),
    ...(weekdayFilter.day !== null && { weekday: weekdayFilter.day }),
    ...(hourFilter.hour !== null && { hour: hourFilter.hour }),
    limit: 5000,
    includeStats: true,
    includeCalendar: true,
    timezone: timezone || 'UTC',
  }), [accountNumbers, dateRange, instruments, pnlRange, timeRange, weekdayFilter, hourFilter, timezone])

  return {
    instruments,
    setInstruments,
    accountNumbers,
    setAccountNumbers,
    dateRange,
    setDateRange,
    pnlRange,
    setPnlRange,
    timeRange,
    setTimeRange,
    weekdayFilter,
    setWeekdayFilter,
    hourFilter,
    setHourFilter,
    tradeFilters,
  }
}
