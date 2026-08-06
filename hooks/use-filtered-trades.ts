

'use client'

import { useQuery } from '@tanstack/react-query'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import type { QueryScope } from '@/lib/query/query-scope'

export interface TradeFilters {
  accounts?: string[]
  dateFrom?: string
  dateTo?: string
  instruments?: string[]
  pnlMin?: number
  pnlMax?: number
  timeRange?: string | null
  weekday?: number | null
  hour?: number | null
  limit?: number
  pageLimit?: number
  pageOffset?: number
  includeStats?: boolean
  includeCalendar?: boolean
  includeWidgets?: boolean
  metricsOnly?: boolean
  timezone?: string
  liveOnly?: boolean
}

export interface FilteredTradesResponse {
  trades: any[]
  total: number
  page?: { limit: number; offset: number } | null
  statistics: any | null
  calendarData: any | null
  widgets: Record<string, any> | null
  meta?:
    | { directPagination: true; truncated: false }
    | { directPagination: false; truncated: boolean }
}

function buildQueryString(filters: TradeFilters): string {
  const params = new URLSearchParams()

  if (filters.accounts?.length) params.set('accounts', filters.accounts.join(','))
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.instruments?.length) params.set('instruments', filters.instruments.join(','))
  if (filters.pnlMin !== undefined) params.set('pnlMin', String(filters.pnlMin))
  if (filters.pnlMax !== undefined) params.set('pnlMax', String(filters.pnlMax))
  if (filters.timeRange) params.set('timeRange', filters.timeRange)
  if (filters.weekday !== null && filters.weekday !== undefined) params.set('weekday', String(filters.weekday))
  if (filters.hour !== null && filters.hour !== undefined) params.set('hour', String(filters.hour))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.pageLimit !== undefined && filters.pageLimit !== null) params.set('pageLimit', String(filters.pageLimit))
  if (filters.pageOffset !== undefined && filters.pageOffset !== null) params.set('pageOffset', String(filters.pageOffset))
  if (filters.includeStats === false) params.set('includeStats', 'false')
  if (filters.includeCalendar === false) params.set('includeCalendar', 'false')
  if (filters.includeWidgets === false) params.set('includeWidgets', 'false')
  if (filters.metricsOnly) params.set('metricsOnly', 'true')
  if (filters.timezone) params.set('timezone', filters.timezone)
  if (filters.liveOnly) params.set('liveOnly', 'true')

  return params.toString()
}

export function useFilteredTrades(
  scope: QueryScope,
  filters: TradeFilters,
  enabled = true,
  isDemoMode = false,
  keepPreviousData = false,
) {
  const queryString = buildQueryString(filters)

  return useQuery<FilteredTradesResponse>({
    queryKey: queryKeys.trades(scope, queryString),
    queryFn: async ({ signal }) => {
      if (isDemoMode) {
        const { getMockDemoData } = await import('@/lib/demo/mock-data')
        return getMockDemoData()
      }
      return apiRequestData<FilteredTradesResponse>(`/api/v1/trades?${queryString}`, {
        signal,
        operation: 'load-filtered-trades',
      })
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    ...(keepPreviousData
      ? { placeholderData: (previous: FilteredTradesResponse | undefined) => previous }
      : {}),
  })
}
