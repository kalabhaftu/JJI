import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('prop firm dashboard widget data contract', () => {
  it('uses account-level server widget metrics instead of fetching raw trades', () => {
    const hook = source('hooks/use-prop-firm-dashboard-widget-data.ts')
    const accountRoute = source('app/api/v1/prop-firm/accounts/[id]/route.ts')

    expect(hook).toContain('accountPayload?.widgetMetrics')
    expect(hook).toContain('resetTimezone')
    expect(hook).not.toContain('/trades?phase=current')
    expect(hook).not.toContain('buildPropFirmGrowth(')
    expect(hook).not.toContain('buildPropFirmDailyDrawdown(')
    expect(hook).not.toContain('buildPropFirmTodayStats(')
    expect(hook).not.toContain('buildPropFirmAccountExtremes(')

    expect(accountRoute).toContain('const widgetMetrics = await withCache')
    expect(accountRoute).toContain('withCache(')
    expect(accountRoute).toContain('CacheKeys.propFirmWidgetMetrics(masterAccountId, resetTimezone, widgetMetricsVersion)')
    expect(accountRoute).toContain('buildPropFirmGrowth(accountData, currentPhaseGroupedTrades, resetTimezone)')
    expect(accountRoute).toContain('buildPropFirmDailyDrawdown(accountData, currentPhaseGroupedTrades, resetTimezone, referenceDate, drawdownData)')
    expect(accountRoute).toContain('widgetMetrics,')
  })

  it('serves phase summaries from the prop firm API for detail pages', () => {
    const accountRoute = source('app/api/v1/prop-firm/accounts/[id]/route.ts')
    const detailPage = source('app/dashboard/prop-firm/accounts/[id]/page.tsx')
    const tradesRoute = source('app/api/v1/prop-firm/accounts/[id]/trades/route.ts')
    const tradesPage = source('app/dashboard/prop-firm/accounts/[id]/trades/page.tsx')

    expect(accountRoute).toContain('const phaseMetricsById = new Map')
    expect(accountRoute).toContain('winRate: phaseTradableTrades > 0')
    expect(detailPage).toContain('const phaseSummaries = useMemo')
    expect(detailPage).toContain('const phaseSummary = getPhaseSummary(phase)')

    expect(tradesRoute).toContain('const statistics = trades.reduce')
    expect(tradesPage).toContain('setTradeStatistics(data.data.statistics')
    expect(tradesPage).not.toContain('const groupedTrades = groupTradesByExecution')
  })
})
