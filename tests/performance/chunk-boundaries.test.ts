import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('route chunk boundaries', () => {
  it('lazy-loads trade replay and editor surfaces', () => {
    const table = source('app/dashboard/table/page.tsx')
    const journal = source('app/dashboard/journal/components/journal-client.tsx')

    expect(table).toContain("dynamic(() => import('../components/trades/trade-replay')")
    expect(table).not.toMatch(/^import TradeReplay/m)
    expect(journal).toContain("import('@/app/dashboard/components/tables/trade-edit-panel')")
    expect(journal).toContain("import('./journal-calendar')")
  })

  it('lazy-loads report tabs', () => {
    const reports = source('app/dashboard/reports/reports-page-client.tsx')

    expect(reports).toContain("dynamic(() => import('./components/statement-view')")
    expect(reports).toContain("dynamic(() => import('./components/propfirm-tab')")
    expect(reports).toContain("import('./components/r-multiple-distribution-chart')")
    expect(reports).not.toContain("from 'recharts'")
  })

  it('uploads Sentry source maps only in hosted or CI builds', () => {
    const config = source('next.config.js')

    expect(config).toContain('disable: !process.env.VERCEL && !process.env.CI')
    expect(config).toContain('deleteSourcemapsAfterUpload: true')
    expect(config).toContain('productionBrowserSourceMaps: false')
  })

  it('isolates analyzer output from the development build directory', () => {
    const config = source('next.config.js')
    const packageJson = source('package.json')

    expect(config).toContain("distDir: process.env.NEXT_DIST_DIR || '.next'")
    expect(packageJson).toContain('NEXT_DIST_DIR=.next-analyze')
  })

  it('keeps the production CORS origin canonical even if an environment value drifts', () => {
    const config = source('next.config.js')

    expect(config).toContain("'https://www.justjournalit.site'")
    expect(config).not.toContain("? 'https://justjournalit.vercel.app'")
  })
})
