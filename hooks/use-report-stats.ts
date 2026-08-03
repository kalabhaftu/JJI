

'use client'

import { useQuery } from '@tanstack/react-query'
import { postFetcher } from '@/lib/query/fetcher'
import type { ReportStatsResponse } from '@/lib/statistics/report-statistics'
import { useUserStore } from '@/store/user-store'
import { isDemoSurface } from '@/lib/public-surface-routing'

export interface UseReportStatsFilters {
  accountId?: string
  dateFrom?: string
  dateTo?: string
  symbol?: string
  session?: string
  outcome?: string
  strategy?: string
  ruleBroken?: string
}

interface UseReportStatsOptions {
  initialData?: ReportStatsResponse
  initialDataKey?: string
}

export function useReportStats(
  filters: UseReportStatsFilters,
  enabled = true,
  options?: UseReportStatsOptions,
) {
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)

  const cleanedFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Record<string, unknown>

  const stableKey = JSON.stringify(cleanedFilters, Object.keys(cleanedFilters).sort())
  const shouldUseInitialData =
    options?.initialData !== undefined &&
    options.initialDataKey !== undefined &&
    options.initialDataKey === stableKey

  return useQuery<ReportStatsResponse>({
    queryKey: ['report-stats', stableKey, isDemo],
    queryFn: async () => {
      if (isDemo) {
        const { getMockReportStats } = await import('@/lib/demo/mock-data')
        return getMockReportStats()
      }
      const result = await postFetcher<ReportStatsResponse>('/api/v1/reports/stats', cleanedFilters) as any
      if (result?.data !== undefined) return result.data as ReportStatsResponse
      return result as ReportStatsResponse
    },
    enabled,
    ...(shouldUseInitialData && options?.initialData !== undefined && { 
      initialData: options.initialData,
      placeholderData: options.initialData 
    }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}
