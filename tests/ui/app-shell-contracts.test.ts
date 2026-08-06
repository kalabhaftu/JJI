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
    expect(source('components/ui/button.tsx')).not.toContain('nav: "text-muted-foreground hover:bg-muted/40 hover:text-foreground"')

    for (const path of [
      'app/dashboard/components/import/import-button.tsx',
      'app/dashboard/components/navbar-display-mode.tsx',
      'app/dashboard/components/navbar-filters/combined-filters.tsx',
      'app/dashboard/components/template-selector.tsx',
      'components/notifications/notification-center.tsx',
      'components/theme-switcher.tsx',
    ]) {
      const contents = source(path)
      expect(contents, path).toContain('variant="tertiary"')
      expect(contents, path).toContain('size="navIcon"')
      expect(contents, path).toContain('text-muted-foreground')
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

  it('lets Radix dismiss collapsed sidebar tooltips instead of controlling stale open state', () => {
    const sidebar = source('components/ui/sidebar.tsx')
    const menuButton = sidebar.slice(sidebar.indexOf('const SidebarMenuButton'))
    const tooltip = source('components/ui/tooltip.tsx')

    expect(menuButton).toContain('<Tooltip>')
    expect(menuButton).not.toContain('tooltipOpen')
    expect(menuButton).not.toContain('hidden={state !== "collapsed" || isMobile}')
    expect(tooltip).toContain('disableHoverableContent')
    expect(tooltip).toContain('data-[state=closed]:hidden')
    expect(tooltip).not.toContain('data-[state=closed]:animate-out')
  })

  it('lets the root metadata template add the JJI title suffix once', () => {
    const rootLayout = source('app/layout.tsx')

    expect(rootLayout).toContain('template: `%s | ${SITE_NAME}`')

    for (const path of [
      'app/contact/page.tsx',
      'app/dashboard/goals/page.tsx',
      'app/dashboard/page.tsx',
      'app/docs/layout.tsx',
      'app/donate/page.tsx',
      'app/feedback/page.tsx',
      'app/privacy/layout.tsx',
      'app/reports/shared/[slug]/page.tsx',
      'app/subscribe/page.tsx',
      'app/terms/layout.tsx',
    ]) {
      expect(source(path), path).not.toMatch(/title:.*\| (?:JJI|\$\{BRAND\.name\})/)
    }
  })
})
