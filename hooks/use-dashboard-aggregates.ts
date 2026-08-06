'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { postFetcher } from '@/lib/query/fetcher'
import type { QueryScope } from '@/lib/query/query-scope'
import type { DashboardAggregateFilters, DashboardAggregates, DashboardDataQuality } from '@/lib/statistics/report-statistics'
import { resolveDashboardDataQuality } from '@/lib/dashboard/aggregates-quality'
import { useUserStore } from '@/store/user-store'

const DEMO_DASHBOARD_AGGREGATES: DashboardAggregates = {
  pnl: { value: 4820.35, formatted: '$4,820.35' },
  winRate: { value: 58.3, formatted: '58.3%' },
  drawdown: { value: 640.2, formatted: '$640.20' },
  tradeCount: 24,
  dataQuality: 'current',
}

export const dashboardAggregatesQueryKeys = {
  all: (scope: QueryScope) => ['dashboard', 'aggregates', scope] as const,
  detail: (scope: QueryScope, filters: DashboardAggregateFilters) =>
    ['dashboard', 'aggregates', scope, filters] as const,
}

function normalizeAggregateFilters(filters: DashboardAggregateFilters): DashboardAggregateFilters {
  return {
    ...filters,
    accountIds: Array.from(new Set(filters.accountIds)).sort(),
  }
}

export function useDashboardAggregates(
  filters: DashboardAggregateFilters,
  enabled = true,
  isDemoMode = false,
) {
  const user = useUserStore((state) => state.user)
  const scope: QueryScope = {
    surface: isDemoMode ? 'demo' : 'authenticated',
    ...(user?.id ? { userId: user.id } : {}),
  }

  const stableFilters = useMemo(
    () => normalizeAggregateFilters(filters),
    [filters.accountIds, filters.from, filters.to, filters.timezone, filters.currency, filters.includeFees],
  )

  const query = useQuery<DashboardAggregates>({
    queryKey: dashboardAggregatesQueryKeys.detail(scope, stableFilters),
    queryFn: async () => {
      if (isDemoMode) return DEMO_DASHBOARD_AGGREGATES
      return postFetcher<DashboardAggregates>('/api/v1/reports/stats', {
        dashboard: true,
        ...stableFilters,
      })
    },
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  const dataQuality: DashboardDataQuality = resolveDashboardDataQuality({
    ...(query.data ? { serverQuality: query.data.dataQuality } : {}),
    hasData: query.data !== undefined,
    isRefetching: query.isRefetching,
    refetchFailed: query.isError,
  })

  return {
    ...query,
    aggregates: query.data ?? null,
    dataQuality,
  }
}
