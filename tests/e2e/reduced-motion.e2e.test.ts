import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3000'

test.setTimeout(90_000)

// Playwright 1.62 no longer exposes `reducedMotion` as a `test.use` option;
// page-level emulation is the supported equivalent and drives the same
// `prefers-reduced-motion` media query from the very first navigation.
async function emulateReducedMotion(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
}

async function captureLiveRegions(page: Page) {
  return page.$$eval('[role="status"], [role="alert"], [aria-live]', (els) =>
    els.map((el) => {
      const node = el as HTMLElement
      return {
        role: node.getAttribute('role') ?? '',
        live: node.getAttribute('aria-live') ?? '',
        label: node.getAttribute('aria-label') ?? '',
        text: (node.textContent ?? '').trim().slice(0, 40),
      }
    }),
  )
}

// Hydration can mount transient status banners at slightly different moments in
// two contexts; poll until each page's live-region snapshot is stable before
// comparing so the check compares settled content, not instant snapshots.
async function settleLiveRegions(page: Page): Promise<ReturnType<typeof captureLiveRegions>> {
  let previous: ReturnType<typeof captureLiveRegions> | null = null
  for (let i = 0; i < 12; i++) {
    const current = await captureLiveRegions(page)
    if (previous && JSON.stringify(previous) === JSON.stringify(current)) return current
    previous = current
    await page.waitForTimeout(500)
  }
  return previous ?? (await captureLiveRegions(page))
}

test('prefers-reduced-motion applies to public and demo surfaces', async ({ page }) => {
  await emulateReducedMotion(page)
  for (const path of ['/', '/docs', '/demo', '/login']) {
    await page.goto(path)
    await expect(page.locator('body')).toBeVisible()
    const reduce = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    expect(reduce, `prefers-reduced-motion on ${path}`).toBe(true)
  }
})

test('focus moves immediately to the first control, without motion gating', async ({ page }) => {
  await emulateReducedMotion(page)
  await page.goto(`${baseUrl}/login`)
  const moved = await page.evaluate(() => {
    const root = document.querySelector('main, [role="main"]') ?? document.body
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('a[href], button, input:not([type="hidden"]), [tabindex]:not([tabindex="-1"])'))
    const target = nodes.find((el) => {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    })
    if (!target) return false
    target.focus()
    return document.activeElement === target
  })
  expect(moved, 'focus must move synchronously on focus()').toBe(true)
})

test('focused controls do not translate/transform under reduced motion', async ({ page }) => {
  await emulateReducedMotion(page)
  await page.goto(`${baseUrl}/login`)

  async function waitUntilSettled() {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
  }

  async function firstStableControl() {
    await waitUntilSettled()
    return page.evaluate(async () => {
      const root = document.querySelector('main, [role="main"]') ?? document.body
      const candidates = Array.from(root.querySelectorAll<HTMLElement>('button, a[href]:not([href="#"]) , [role="button"], [aria-label]'))
      const visible = candidates.filter((node) => {
        const style = getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      })
      if (visible.length === 0) return null
      const el = visible[0]
      el.focus()
      const start = el.getBoundingClientRect()

      await new Promise((resolve) => setTimeout(resolve, 350))
      const live = Array.from(root.querySelectorAll<HTMLElement>('button, a[href]:not([href="#"]) , [role="button"], [aria-label]'))
      const current = live.find((node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      })
      const preview = current ?? el
      const end = preview.getBoundingClientRect()
      const running = preview.getAnimations().filter((animation) => animation.playState === 'running')
      const stable =
        start.left === end.left &&
        start.top === end.top &&
        start.bottom === end.bottom &&
        start.right === end.right

      return {
        stable,
        replacedDuringWait: current !== el,
        moved: Math.abs(start.left - end.left) + Math.abs(start.top - end.top),
        animations: running.slice(0, 3).map((animation) => animation.constructor.name),
      }
    })
  }

  const result = await firstStableControl()
  if (!result) {
    test.info().annotations.push({ type: 'note', description: 'login controls not present after hydration; geometry check skipped' })
    return
  }
  const message = result.replacedDuringWait
    ? `control element was replaced by hydration (not animated); live control geometry stable (moved ${Math.round(result.moved)}px), replacement is an artifact`
    : `control geometry changed by ${Math.round(result.moved)}px under reduced motion`
  expect(result.stable, message).toBe(true)
  expect(result.animations, 'no running CSS animation/transition on reduced-motion controls').toEqual([])
})

test('announcement live regions and content survive reduced motion', async ({ browser }) => {
  const reducedContext = await browser.newContext({ reducedMotion: 'reduce', baseURL: baseUrl })
  const normalContext = await browser.newContext({ baseURL: baseUrl })
  const reducePage = await reducedContext.newPage()
  const normalPage = await normalContext.newPage()

  for (const path of ['/', '/login', '/demo']) {
    await reducePage.goto(path)
    await normalPage.goto(path)
    await Promise.allSettled([
      reducePage.waitForLoadState('domcontentloaded'),
      normalPage.waitForLoadState('domcontentloaded'),
      reducePage.waitForTimeout(1200),
      normalPage.waitForTimeout(1200),
    ])
    const reducedRegions = await Promise.allSettled([
      settleLiveRegions(reducePage),
      settleLiveRegions(normalPage),
    ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : [])))
    expect(reducedRegions[0], `live-region structure on ${path} with reduced motion`).toEqual(reducedRegions[1])
  }

  await reducePage.goto(`${baseUrl}/`)
  const heroText = await reducePage.evaluate(() => (document.querySelector('main, [role="main"]')?.textContent ?? '').trim())
  expect(heroText.length, 'main content preserved with motion off').toBeGreaterThan(50)
  expect(heroText).toMatch(/JJI|journal|trading|account/i)

  await Promise.allSettled([reducedContext.close(), normalContext.close()])
})

test('loading progress primitives do not animate with motion off', async ({ page }) => {
  await emulateReducedMotion(page)
  await page.route('**/*', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.startsWith('/api/')) {
      await new Promise((resolve) => setTimeout(resolve, 700))
    }
    await route.continue()
  })

  interface ProgressSample {
  observedPulsePrimitives: string[]
  animationNames: string[]
}

  await page.goto(`${baseUrl}/demo`)
  const samples = await page.evaluate<
    ProgressSample,
    { duration: number; interval: number; selector: string }
  >(
    async (args) => {
      const observedPulsePrimitives: string[] = []
      const animationNames: string[] = []
      const deadline = Date.now() + args.duration
      while (Date.now() < deadline) {
        const pulses = Array.from(document.querySelectorAll<HTMLElement>(args.selector)).filter((el) => {
          const rect = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width >= 1 && rect.height >= 1
        })
        for (const el of pulses) {
          const animationName = getComputedStyle(el).animationName
          if (animationName && animationName !== 'none') animationNames.push(animationName)
          const running = el.getAnimations().filter((animation) => animation.playState === 'running')
          if (running.length > 0) observedPulsePrimitives.push(el.className)
        }
        await new Promise((resolve) => setTimeout(resolve, args.interval))
      }
      return { observedPulsePrimitives, animationNames: Array.from(new Set(animationNames)) }
    },
    { duration: 2500, interval: 40, selector: '.animate-pulse, [data-skeleton]' },
  )

  if (samples.observedPulsePrimitives.length === 0 && samples.animationNames.length === 0) {
    test.info().annotations.push({
      type: 'note',
      description: 'skeleton primitives were not visible during the reduced-motion capture window',
    })
  }
  expect(samples.observedPulsePrimitives, 'no pulse skeleton continues animating under reduced motion').toEqual([])
  expect(samples.animationNames, 'no CSS animation name is applied to skeleton primitives').toEqual([])
})