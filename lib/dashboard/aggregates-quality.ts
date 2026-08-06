import type { DashboardDataQuality } from '@/lib/statistics/report-statistics'

export interface ResolveDashboardDataQualityInput {
  serverQuality?: DashboardDataQuality
  hasData: boolean
  isRefetching: boolean
  refetchFailed: boolean
}

export function resolveDashboardDataQuality(input: ResolveDashboardDataQualityInput): DashboardDataQuality {
  if (input.hasData && input.refetchFailed && !input.isRefetching) {
    return 'stale'
  }
  return input.serverQuality ?? 'unavailable'
}
