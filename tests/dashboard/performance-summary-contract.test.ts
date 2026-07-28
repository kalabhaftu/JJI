import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('performance summary widget contract', () => {
  it('uses server-computed summary metrics for drawdown and R coverage', () => {
    const tradeAnalytics = source('server/trades/analytics.ts')
    const calculations = source('lib/dashboard/analytics-calculations.ts')
    const widget = source('app/dashboard/components/charts/performance-summary.tsx')

    expect(tradeAnalytics).toContain('performanceSummary: safeWidget(() => calculatePerformanceSummaryMetrics(trades)')
    expect(calculations).toContain('export function calculatePerformanceSummaryMetrics')
    expect(calculations).toContain('hasValidTradeRMultipleData')

    expect(widget).toContain("useWidgetData('performanceSummary')")
    expect(widget).toContain('summaryMetrics?.rCoverage')
    expect(widget).not.toContain('formattedTrades.reduce')
    expect(widget).not.toContain('for (const point of chartData)')
  })
})
