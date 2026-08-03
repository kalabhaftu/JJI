import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('demo isolation', () => {
  it('requires migrated navigation callers to resolve surface-aware paths', () => {
    for (const path of [
      'app/dashboard/components/sidebar/dashboard-sidebar.tsx',
      'components/ui/mobile-nav.tsx',
      'components/dashboard-shell-actions.tsx',
      'app/dashboard/components/empty-account-state.tsx',
      'app/dashboard/components/empty-trade-state.tsx',
      'app/dashboard/components/navbar.tsx',
      'app/dashboard/data/page.tsx',
      'app/dashboard/table/page.tsx',
    ]) {
      expect(source(path), path).toContain('resolveNavigationPath')
    }
  })

  it('restores fetch and refuses to intercept after leaving /demo', () => {
    const interceptor = source('app/demo/components/demo-network-interceptor.tsx')
    expect(interceptor).toContain('isDemoSurface(window.location.hostname, window.location.pathname)')
    expect(interceptor).toContain('window.fetch = originalFetch')
    expect(interceptor).toContain("error: 'Not implemented in demo mode'")
  })

  it('keeps the large demo fixture out of production entry chunks', () => {
    for (const path of [
      'context/data-provider.tsx',
      'hooks/use-filtered-trades.ts',
      'hooks/use-report-stats.ts',
      'hooks/use-journal.ts',
    ]) {
      expect(source(path)).not.toMatch(/^import .*@\/lib\/demo\/mock-data/m)
    }
  })
})
