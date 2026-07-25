import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isAppShellPath } from '@/lib/navigation/app-shell'
import {
  getActiveMobileNavId,
  getMobileNavHref,
  MOBILE_NAV_DESTINATIONS,
} from '@/lib/navigation/mobile-nav'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('app shell navigation contracts', () => {
  it('hides the marketing footer from every application shell', () => {
    for (const pathname of [
      '/dashboard',
      '/dashboard/ai',
      '/demo',
      '/demo/reports',
      '/login',
      '/app-launch',
      '/reports/shared/example',
    ]) {
      expect(isAppShellPath(pathname), pathname).toBe(true)
    }

    for (const pathname of ['/', '/docs', '/privacy', '/terms', '/contact']) {
      expect(isAppShellPath(pathname), pathname).toBe(false)
    }
  })

  it('declares exactly one bottom nav in each dashboard shell and none globally', () => {
    expect(source('app/dashboard/layout.tsx').match(/<MobileBottomNav\s*\/>/g)).toHaveLength(1)
    expect(source('app/demo/layout.tsx').match(/<MobileBottomNav\s*\/>/g)).toHaveLength(1)
    expect(source('app/layout.tsx')).not.toContain('MobileBottomNav')
  })

  it('keeps five unique destinations and maps demo links without stale dashboard routes', () => {
    expect(MOBILE_NAV_DESTINATIONS).toHaveLength(5)
    expect(new Set(MOBILE_NAV_DESTINATIONS.map((item) => item.id)).size).toBe(5)
    expect(new Set(MOBILE_NAV_DESTINATIONS.map((item) => item.href)).size).toBe(5)

    for (const item of MOBILE_NAV_DESTINATIONS) {
      expect(getMobileNavHref(item.href, false)).toBe(item.href)
      expect(getMobileNavHref(item.href, true)).toMatch(/^\/demo(?:\/|$)/)
    }
  })

  it('selects the correct active destination for dashboard and demo routes', () => {
    expect(getActiveMobileNavId('/dashboard', false)).toBe('widgets')
    expect(getActiveMobileNavId('/dashboard/journal/day', false)).toBe('journal')
    expect(getActiveMobileNavId('/dashboard/reports', false)).toBe('reports')
    expect(getActiveMobileNavId('/dashboard/table', false)).toBe('table')
    expect(getActiveMobileNavId('/dashboard/accounts/1', false)).toBe('accounts')
    expect(getActiveMobileNavId('/demo/reports', true)).toBe('reports')
    expect(getActiveMobileNavId('/login', false)).toBeNull()
  })
})
