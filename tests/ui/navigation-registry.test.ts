import { describe, expect, it } from 'vitest'

import {
  getActiveNavigationId,
  getMoreNavigation,
  getNavigationEntries,
  getPrimaryMobileNavigation,
  resolveNavigationPath,
  type NavigationContext,
} from '@/lib/navigation/registry'

const authenticated: NavigationContext = { surface: 'authenticated', isDemo: false }
const demo: NavigationContext = { surface: 'demo', isDemo: true }

describe('navigation registry', () => {
  it('resolves canonical application paths for authenticated and demo surfaces', () => {
    expect(resolveNavigationPath('reports', authenticated)).toBe('/dashboard/reports')
    expect(resolveNavigationPath('reports', demo)).toBe('/demo/reports')
    expect(resolveNavigationPath('settings', demo)).toBe('/demo/settings')
  })

  it('never emits dashboard destinations on the demo surface', () => {
    for (const entry of getNavigationEntries(demo)) {
      expect(resolveNavigationPath(entry, demo), entry.id).not.toMatch(/^\/dashboard(?:\/|$)/)
    }
  })

  it('matches nested destinations using the most specific path', () => {
    expect(getActiveNavigationId('/dashboard/reports/monthly', authenticated)).toBe('reports')
    expect(getActiveNavigationId('/dashboard/accounts/abc', authenticated)).toBe('accounts')
    expect(getActiveNavigationId('/demo/table/one', demo)).toBe('table')
  })

  it('provides stable primary and More mobile groups', () => {
    expect(getPrimaryMobileNavigation(authenticated).map((entry) => entry.id)).toEqual([
      'overview', 'journal', 'table', 'reports', 'more',
    ])
    expect(getMoreNavigation(demo).map((entry) => entry.id)).toContain('settings')
  })

  it('routes donation support to the public donate page from docs', () => {
    expect(resolveNavigationPath('donate', { surface: 'docs', isDemo: false })).toBe('/donate')
  })
})
