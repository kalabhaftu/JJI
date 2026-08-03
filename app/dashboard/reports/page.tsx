import { subDays } from 'date-fns'
import ReportsPageClient from './reports-page-client'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import {
  calculateReportStatistics,
  type ReportStatsResponse,
} from '@/lib/statistics/report-statistics'
import {
  calculatePropFirmStatistics,
  type PropFirmSummaryDTO,
} from '@/lib/statistics/propfirm-statistics'

function getStableFilterKey(filters: Record<string, unknown>) {
  return JSON.stringify(filters, Object.keys(filters).sort())
}

export default async function ReportsPage() {
  let initialReportData: ReportStatsResponse | null = null
  let initialPropFirmData: PropFirmSummaryDTO | null = null
  let initialReportKey: string | undefined

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (identity?.internalUserId) {
      const to = new Date()
      const from = subDays(to, 90)

      const initialFilters = {
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
      }

      const [reportData, propFirmData] = await Promise.all([
        calculateReportStatistics({
          userId: identity.internalUserId,
          ...initialFilters,
        }),
        calculatePropFirmStatistics(identity.internalUserId),
      ])

      initialReportData = reportData
      initialPropFirmData = propFirmData
      initialReportKey = getStableFilterKey(initialFilters)
    }
  } catch {

  }

  return (
    <ReportsPageClient
      initialReportData={initialReportData}
      {...(initialReportKey !== undefined && { initialReportKey })}
      initialPropFirmData={initialPropFirmData}
    />
  )
}
