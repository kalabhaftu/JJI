import { expect, type Page } from '@playwright/test'

// Shared scenario list. Matches the plan's `viewports` const exactly.
export const viewports = [
  { name: '320', width: 320, height: 900 },
  { name: '375', width: 375, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1280', width: 1280, height: 900 },
  { name: 'wide', width: 1600, height: 1000 },
] as const

// Selected exact routes from the plan, grouped by shared family. The routes
// share a layout/behavior family, so identical assertions are not duplicated
// per instantiated route; each family representative covers the viewport grid
// and each exact route is swept at the narrowest breakpoint below.
export const selectedRoutes = {
  public: ['/', '/login', '/subscribe/status', '/docs', '/not-found'],
  shared: ['/reports/shared/[slug]'],
  demo: ['/demo'],
  dashboard: [
    '/dashboard',
    '/dashboard/journal',
    '/dashboard/reports',
    '/dashboard/table',
    '/dashboard/trades/new',
    '/dashboard/accounts',
    '/dashboard/accounts/[id]',
    '/dashboard/import',
    '/dashboard/data',
    '/dashboard/ai',
    '/dashboard/playbook',
    '/dashboard/backtesting',
    '/dashboard/goals',
    '/dashboard/settings',
  ],
  propFirm: [
    '/dashboard/prop-firm/accounts/[id]',
    '/dashboard/prop-firm/accounts/[id]/trades',
    '/dashboard/prop-firm/accounts/[id]/settings',
    '/dashboard/prop-firm/accounts/[id]/payouts/request',
  ],
} as const satisfies Record<string, readonly string[]>

export const allSelectedRoutes: readonly string[] = Object.values(selectedRoutes).flat()

export const familyRepresentative: Record<string, string> = {
  public: '/',
  shared: '/reports/shared/[slug]',
  demo: '/demo',
  dashboard: '/dashboard',
  propFirm: '/dashboard/prop-firm/accounts/[id]',
}

export const AUTH_STORAGE_STATE = process.env.PLAYWRIGHT_AUTH_STORAGE_STATE
const DEFAULT_TEST_ACCOUNT_ID = 'demo-account-1'
export const testAccountId = process.env.PLAYWRIGHT_TEST_ACCOUNT_ID ?? DEFAULT_TEST_ACCOUNT_ID

export const isRefusedProductionTarget = (baseUrl?: string): boolean => {
  const base = baseUrl ?? process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3000'
  return /(?:^|\.)justjournalit\.site$/i.test(new URL(base).hostname)
}

// `/dashboard*` routes redirect unauthenticated requests to `/login`, so they
// only run when an explicit preview storage state is supplied.
export const requiresAuthentication = (route: string): boolean => route.startsWith('/dashboard')

export function resolveRoute(route: string): string {
  return route
    .replace(/\[slug\]/g, 'e2e-missing-slug')
    .replace(/\[id\]/g, testAccountId)
}

export const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
  '[role="link"]',
  '[tabindex]:not([tabindex="-1"])',
  'summary',
].join(',')

// Local overflow detection: the document and body must not exceed the layout
// viewport by more than the allowed epsilon.
export async function assertNoPageOverflow(page: Page, label = 'page') {
  const dims = await page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      body: body ? body.scrollWidth - body.clientWidth : 0,
      viewport: doc.clientWidth,
    }
  })
  expect(dims.doc, `[${label}] document horizontal overflow ${dims.doc}px at ${dims.viewport}px`).toBeLessThanOrEqual(1)
  expect(dims.body, `[${label}] body horizontal overflow ${dims.body}px at ${dims.viewport}px`).toBeLessThanOrEqual(1)
}

export async function assertPrimaryContentVisible(page: Page, fallback: (v: number) => unknown = (n) => expect(n).toBeGreaterThan(0)) {
  await expect(page.locator('body')).toBeVisible()
  const main = page.locator('main, [role="main"]').first()
  if (await main.count()) {
    await expect(main).toBeVisible()
  } else {
    const length = await page.evaluate(() => (document.body.innerText ?? '').trim().length)
    fallback(length)
  }
}

// Sticky-focus: focus the first reachable control, bring it into view, and
// require the focused element to remain inside the visible viewport.
export async function focusControlInsideViewport(page: Page) {
  type FocusResult =
    | { found: true; tag: string; activeMatches: boolean; rect: { left: number; right: number; top: number; bottom: number }; viewportWidth: number; viewportHeight: number }
    | { found: false }

  const result = await page.evaluate<FocusResult, string>((selector) => {
    const root = document.querySelector('main, [role="main"]') ?? document.body
    for (const node of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
      const style = getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const rect = node.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') continue
      if (node.closest('[aria-hidden="true"]')) continue
      try {
        node.focus()
        node.scrollIntoView({ block: 'center', inline: 'center' })
      } catch {
        continue
      }
      const after = node.getBoundingClientRect()
      return {
        found: true,
        tag: node.tagName,
        activeMatches: document.activeElement === node,
        rect: {
          left: after.left,
          right: after.right,
          top: after.top,
          bottom: after.bottom,
        },
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
      }
    }
    return { found: false }
  }, INTERACTIVE_SELECTOR)

  if (!result || !result.found) {
    await expect(page.locator('body')).toBeVisible()
    return
  }
  expect(result.activeMatches, 'focus moved to the first reachable control').toBe(true)
  expect(result.rect.left, `focused ${result.tag} stays within viewport left`).toBeGreaterThanOrEqual(-1)
  expect(result.rect.right, `focused ${result.tag} stays within viewport right`).toBeLessThanOrEqual(result.viewportWidth + 1)
  expect(result.rect.top, `focused ${result.tag} stays within viewport top`).toBeGreaterThanOrEqual(-1)
  expect(result.rect.bottom, `focused ${result.tag} stays within viewport bottom`).toBeLessThanOrEqual(result.viewportHeight + 1)
}

export async function doesEmulateCoarsePointer(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const prefers = window.matchMedia
    return (
      typeof prefers === 'function' &&
      (prefers('(any-pointer: coarse)').matches || prefers('(pointer: coarse)').matches)
    )
  })
}

// Primary touch-action targets on a coarse pointer must be at least 44x44 CSS
// px. Inline text links, checkboxes, and radios are not primary targets and
// are intentionally excluded to stay locale-agnostic (no localized strings).
export async function assertPrimaryTouchTargets(page: Page) {
  const violations = await page.evaluate((selector) => {
    const isPrimaryControl = (el: HTMLElement) => {
      if (/^(button|input|select|textarea|summary)$/i.test(el.tagName)) return true
      if (['button', 'tab', 'link', 'menuitem'].includes(el.getAttribute('role') ?? '')) return true
      if (el.getAttribute('aria-label') || el.getAttribute('data-testid')) return true
      if (el.tagName !== 'A') return false
      const style = getComputedStyle(el)
      const hasBackdrop = style.backgroundImage !== 'none' || style.backgroundColor !== 'rgba(0, 0, 0, 0)'
      const hasBorder = style.borderTopWidth !== '0px' || style.borderLeftWidth !== '0px'
      const hasPadding = parseFloat(style.paddingTop) >= 6 || parseFloat(style.paddingLeft) >= 10
      return hasBackdrop || hasBorder || hasPadding
    }
    const offenders: Array<{ tag: string; name: string; width: number; height: number }> = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const input = el as HTMLInputElement
      if (input.disabled) continue
      if (input.type === 'checkbox' || input.type === 'radio') continue
      if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) continue
      if (!isPrimaryControl(el)) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue
      if (rect.width >= 44 && rect.height >= 44) continue
      offenders.push({
        tag: el.tagName,
        name: (el.getAttribute('aria-label') ?? el.getAttribute('data-testid') ?? el.textContent?.trim() ?? el.tagName).slice(0, 48),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })
    }
    return offenders
  }, INTERACTIVE_SELECTOR)

  expect(violations, 'primary touch targets must be at least 44x44px').toEqual([])
}

export async function emulate200PercentTextZoom(page: Page) {
  const before = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
  const after = await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
    return parseFloat(getComputedStyle(document.documentElement).fontSize)
  })
  expect(after, 'zoom emulation must actually scale text').toBeGreaterThanOrEqual(before * 1.9)
  return { before, after }
}

export interface StickyActionOffender {
  name: string
  left: number
  right: number
}

export async function assertStickyActionsWithinViewport(page: Page) {
  const offenders = await page.evaluate((selector) => {
    const out: StickyActionOffender[] = []
    const viewportWidth = document.documentElement.clientWidth
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const style = getComputedStyle(el)
      if (style.position !== 'sticky' && style.position !== 'fixed') continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue
      if (rect.left < -1 || rect.right > viewportWidth + 1) {
        out.push({
          name: (el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName).slice(0, 48),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        })
      }
    }
    return out
  }, INTERACTIVE_SELECTOR)

  expect(offenders, 'sticky action controls remain within the viewport width').toEqual([])
}

export interface RenderingSample {
  pulseCount: number
  wholePagePulse: boolean
  maxPulseRatio: number
  badText: boolean
  bodyLength: number
}

// Sample the document while a route boundary is loading. Each sample records
// whether undefined/NaN leaked into the text, and the shape of any pulse
// skeleton that is on screen at that moment.
export async function sampleLoadingShell(page: Page, durationMs = 4000, intervalMs = 60): Promise<RenderingSample[]> {
  return page.evaluate(
    async ({ duration, interval, selector }) => {
      const out: Array<RenderingSample> = []
      const deadline = Date.now() + duration
      while (Date.now() < deadline) {
        const bodyText = document.body?.innerText ?? ''
        const pulses = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => {
          const style = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width >= 1 && rect.height >= 1
        })
        const wholePagePulse = pulses.some((el) => {
          const rect = el.getBoundingClientRect()
          return rect.width >= innerWidth * 0.8 && rect.height >= innerHeight * 0.8
        })
        const ratios = pulses.map((el) => {
          const rect = el.getBoundingClientRect()
          return (rect.width * rect.height) / (Math.max(innerWidth, 1) * Math.max(innerHeight, 1))
        })
        out.push({
          pulseCount: pulses.length,
          wholePagePulse,
          maxPulseRatio: ratios.length ? Math.max(...ratios) : 0,
          badText: /undefined|NaN/.test(bodyText),
          bodyLength: bodyText.length,
        })
        await new Promise((resolve) => setTimeout(resolve, interval))
      }
      return out
    },
    { duration: durationMs, interval: intervalMs, selector: '.animate-pulse, [data-skeleton]' }
  )
}