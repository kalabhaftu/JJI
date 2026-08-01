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
      if (item.id === 'more') {
        expect(getMobileNavHref(item.href, true)).toBe('#more')
      } else {
        expect(getMobileNavHref(item.href, true)).toMatch(/^\/demo(?:\/|$)/)
      }
    }

    expect(MOBILE_NAV_DESTINATIONS.map(({ label }) => label)).toEqual([
      'Overview',
      'Journal',
      'Trades',
      'Reports',
      'More',
    ])
  })

  it('selects the correct active destination for dashboard and demo routes', () => {
    expect(getActiveMobileNavId('/dashboard', false)).toBe('widgets')
    expect(getActiveMobileNavId('/dashboard/journal/day', false)).toBe('journal')
    expect(getActiveMobileNavId('/dashboard/reports', false)).toBe('reports')
    expect(getActiveMobileNavId('/dashboard/table', false)).toBe('table')
    expect(getActiveMobileNavId('/dashboard/accounts/1', false)).toBe('more')
    expect(getActiveMobileNavId('/demo/reports', true)).toBe('reports')
    expect(getActiveMobileNavId('/login', false)).toBeNull()
  })

  it('keeps dashboard navbar actions on the shared compact nav button contract', () => {
    expect(source('components/ui/button.tsx')).toContain('navIcon: "h-8 w-8 rounded-lg"')
    expect(source('components/ui/button.tsx')).toContain('nav: "text-muted-foreground hover:bg-muted/40 hover:text-foreground"')

    for (const path of [
      'app/dashboard/components/import/import-button.tsx',
      'app/dashboard/components/navbar-display-mode.tsx',
      'app/dashboard/components/navbar-filters/combined-filters.tsx',
      'app/dashboard/components/template-selector.tsx',
      'components/notifications/notification-center.tsx',
      'components/theme-switcher.tsx',
    ]) {
      const contents = source(path)
      expect(contents, path).toContain('variant="nav"')
      expect(contents, path).toContain('size="navIcon"')
    }

    const importTrigger = source('app/dashboard/components/import/import-button.tsx')
      .slice(
        source('app/dashboard/components/import/import-button.tsx').indexOf('data-tour="import-nav-btn"') - 250,
        source('app/dashboard/components/import/import-button.tsx').indexOf('data-tour="import-nav-btn"') + 250,
      )
    expect(importTrigger).not.toContain('variant="outline"')
    expect(importTrigger).not.toContain('whileHover')
    expect(importTrigger).not.toContain('Import Trades</span>')
  })

  it('closes collapsed sidebar tooltips instead of keeping hidden tooltip content mounted', () => {
    const sidebar = source('components/ui/sidebar.tsx')
    const menuButton = sidebar.slice(sidebar.indexOf('const SidebarMenuButton'))

    expect(menuButton).toContain('open={tooltipOpen}')
    expect(menuButton).toContain('onOpenChange={setTooltipOpen}')
    expect(menuButton).toContain('onPointerLeave={(event) =>')
    expect(menuButton).toContain('onBlur={(event) =>')
    expect(menuButton).toContain('onClick={(event) =>')
    expect(menuButton).not.toContain('hidden={state !== "collapsed" || isMobile}')
  })
})
