import { statSync } from 'node:fs'
import { resolve } from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test as base } from '@playwright/test'

export { expect }

export const publicRoutes = ['/', '/login', '/docs', '/donate'] as const
export const demoRoutes = ['/demo', '/demo/reports', '/demo/journal'] as const

export const DEMO_ACCOUNT_ID = 'mock-acc-1'
export const DEMO_PROP_FIRM_ACCOUNT_ID = 'mock-propfirm-1'
export const SHARED_REPORT_SLUG = 'e2e-missing-report'
export const NOT_FOUND_PATH = '/__e2e-route-that-does-not-exist__'

export const PRODUCTION_HOST_SURFACES = ['justjournalit.site', 'justjournalit.app', 'vercel.app'] as const

export function isProductionHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return PRODUCTION_HOST_SURFACES.some(
    (surface) => normalized === surface || normalized.endsWith(`.${surface}`),
  )
}

export function refuseProductionHost(page: Page): void {
  const hostname = new URL(page.url()).hostname
  expect(
    isProductionHost(hostname),
    `refusing to run accessibility/keyboard scenarios against production host: ${hostname}`,
  ).toBe(false)
}

export async function navigateRefusingProduction(page: Page, path: string): Promise<void> {
  await page.goto(path)
  refuseProductionHost(page)
}

export function configuredAuthStorageState(): string | undefined {
  return process.env.PLAYWRIGHT_AUTH_STORAGE_STATE || undefined
}

export function hasAuthStorageState(): boolean {
  const path = configuredAuthStorageState()
  if (!path) return false
  try {
    return statSync(resolve(process.cwd(), path)).isFile()
  } catch {
    return false
  }
}

export const DEFAULT_VIEWPORT = { width: 1280, height: 900 } as const
export const MOBILE_VIEWPORT = { width: 375, height: 900 } as const

export type AppState = 'public' | 'demo' | 'authenticated'
export type ThemePreference = 'dark' | 'light' | 'system'
export type AccentPack = 'classic' | 'reports' | 'violet' | 'slate'
export const ACCENT_PACKS: readonly AccentPack[] = ['classic', 'reports', 'violet', 'slate']

export interface RouteMetadata {
  routeFamily: string
  state: AppState
  viewport: { width: number; height: number }
  theme: ThemePreference
  accentPack: AccentPack
}

export function describeScenario(
  routeFamily: string,
  state: AppState,
  viewport: { width: number; height: number } = DEFAULT_VIEWPORT,
  theme: ThemePreference = 'dark',
  accentPack: AccentPack = 'classic',
): RouteMetadata {
  return { routeFamily, state, viewport, theme, accentPack }
}

interface ScanViolation {
  id: string
  impact: string | null
  nodes: number
}

export interface AxeScanSummary {
  counts: { critical: number; serious: number; moderate: number; minor: number }
  violations: ScanViolation[]
}

export async function runAxeScan(
  page: Page,
  options: { routeFamily: string; disabledRules?: string[] } = { routeFamily: 'unknown' },
): Promise<AxeScanSummary> {
  const builder = new AxeBuilder({ page })
  if (options.disabledRules && options.disabledRules.length > 0) {
    builder.disableRules(options.disabledRules)
  }
  const { violations } = await builder.analyze()

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  for (const violation of violations) {
    if (violation.impact === 'critical') counts.critical += 1
    else if (violation.impact === 'serious') counts.serious += 1
    else if (violation.impact === 'moderate') counts.moderate += 1
    else if (violation.impact === 'minor') counts.minor += 1
  }

  return {
    counts,
    violations: violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? null,
      nodes: violation.nodes.length,
    })),
  }
}

export function expectNoCriticalOrSerious(summary: AxeScanSummary): void {
  const failing = summary.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  )
  expect(
    failing,
    `critical/serious axe violations found: ${failing.map((violation) => violation.id).join(', ')}`,
  ).toEqual([])
}

export async function tabUntilFocused(page: Page, target: Locator, maxTabs = 24): Promise<boolean> {
  for (let step = 0; step < maxTabs; step += 1) {
    await page.keyboard.press('Tab')
    const isTarget = await target.evaluate((element) => element === document.activeElement)
    if (isTarget) return true
  }
  return false
}

export async function focusIsVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    if (!element) return false
    const rect = element.getBoundingClientRect()
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      getComputedStyle(element).visibility !== 'hidden' &&
      element.getAttribute('aria-hidden') !== 'true'
    )
  })
}

export type E2EFixtures = {
  assertPageReady: (path: string) => Promise<void>
  hasAuthenticatedState: boolean
  authenticatedPage: Page
  demoPage: Page
  visualPage: Page
  reducedMotionPage: Page
}

export const test = base.extend<E2EFixtures>({
  assertPageReady: async ({ page }, provide) => {
    await provide(async (path: string) => {
      await navigateRefusingProduction(page, path)
      await expect(page.locator('body')).toBeVisible()
      await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
    })
  },

  hasAuthenticatedState: async ({}, provide) => {
    await provide(hasAuthStorageState())
  },

  authenticatedPage: async ({ browser }, provide) => {
    test.skip(
      !hasAuthStorageState(),
      'no explicit PLAYWRIGHT_AUTH_STORAGE_STATE file; skipping authenticated scenario',
    )
    const context = await browser.newContext({ storageState: configuredAuthStorageState() as string })
    const page = await context.newPage()
    await provide(page)
    await context.close()
  },

  demoPage: async ({ browser }, provide) => {
    const context = await browser.newContext({
      viewport: { ...DEFAULT_VIEWPORT },
      colorScheme: 'dark',
    })
    const page = await context.newPage()
    await provide(page)
    await context.close()
  },

  visualPage: async ({ browser }, provide) => {
    const context = await browser.newContext({
      viewport: { ...DEFAULT_VIEWPORT },
      colorScheme: 'light',
    })
    const page = await context.newPage()
    await provide(page)
    await context.close()
  },

  reducedMotionPage: async ({ browser }, provide) => {
    const context = await browser.newContext({
      viewport: { ...DEFAULT_VIEWPORT },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    await provide(page)
    await context.close()
  },
})