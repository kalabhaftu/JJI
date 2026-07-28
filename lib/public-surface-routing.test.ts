import { describe, expect, it } from 'vitest'

import {
  DEMO_ORIGIN,
  DOCS_ORIGIN,
  getDemoAwarePathname,
  getDemoHref,
  getDemoRouteHref,
  getDocsHref,
  isDemoSurface,
} from '@/lib/public-surface-routing'

describe('public surface routing', () => {
  it('keeps docs links clean on the docs host', () => {
    expect(getDocsHref('/docs/features/importing', 'docs.justjournalit.site')).toBe('/features/importing')
    expect(getDocsHref('/docs', 'docs.justjournalit.site')).toBe('/')
  })

  it('sends production app docs links to the docs subdomain', () => {
    expect(getDocsHref('/docs/getting-started', 'www.justjournalit.site')).toBe(
      `${DOCS_ORIGIN}/getting-started`
    )
  })

  it('keeps preview docs links path-based', () => {
    expect(getDocsHref('/docs/getting-started', 'justjournalit.vercel.app')).toBe('/docs/getting-started')
  })

  it('keeps demo links clean on the demo host', () => {
    expect(getDemoRouteHref('/dashboard/reports', true, 'demo.justjournalit.site')).toBe('/reports')
    expect(getDemoHref('/demo/accounts/mock-acc-1', 'demo.justjournalit.site')).toBe('/accounts/mock-acc-1')
  })

  it('sends production app demo links to the demo subdomain', () => {
    expect(getDemoRouteHref('/dashboard/reports', true, 'www.justjournalit.site')).toBe(
      `${DEMO_ORIGIN}/reports`
    )
  })

  it('maps clean demo host pathnames back to demo routes for active-state logic', () => {
    expect(getDemoAwarePathname('/reports', true, 'demo.justjournalit.site')).toBe('/demo/reports')
    expect(getDemoAwarePathname('/dashboard/reports', false, 'demo.justjournalit.site')).toBe('/dashboard/reports')
  })

  it('detects demo mode by hostname or legacy path', () => {
    expect(isDemoSurface('demo.justjournalit.site', '/')).toBe(true)
    expect(isDemoSurface('www.justjournalit.site', '/demo/reports')).toBe(true)
    expect(isDemoSurface('www.justjournalit.site', '/dashboard/reports')).toBe(false)
  })
})
