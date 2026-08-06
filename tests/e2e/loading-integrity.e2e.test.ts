import { expect, test } from './fixtures'
import {
  AUTH_STORAGE_STATE,
  isRefusedProductionTarget,
  resolveRoute,
  sampleLoadingShell,
} from './responsive-helpers'

const storageState = AUTH_STORAGE_STATE
const isProductionTarget = isRefusedProductionTarget()

test.setTimeout(120_000)

// Dashboard boundaries that declare a Next.js loading.tsx boundary. Each is
// checked for empty/undefined/NaN rendering and for skeleton primitives
// (atomic pulse blocks) instead of a single whole-page pulse.
const dashboardBoundaries = [
  '/dashboard',
  '/dashboard/journal',
  '/dashboard/reports',
  '/dashboard/table',
  '/dashboard/trades/new',
  '/dashboard/accounts',
  '/dashboard/accounts/[id]',
  '/dashboard/data',
  '/dashboard/playbook',
  '/dashboard/backtesting',
  '/dashboard/goals',
  '/dashboard/settings',
  '/dashboard/prop-firm/accounts/[id]',
  '/dashboard/prop-firm/accounts/[id]/payouts/request',
]

const publicSurfaces = ['/', '/login', '/subscribe/status', '/docs', '/demo', '/reports/shared/[slug]', '/not-found']

// The loading boundary must never leak raw "undefined" or "NaN" into text,
// and any skeleton it shows must be composed of small atomic pulse primitives
// rather than one whole-page pulsing block.
test.describe('loading boundary integrity', () => {
  for (const route of dashboardBoundaries) {
    test.describe(`route ${route}`, () => {
      test.skip(!storageState, 'PLAYWRIGHT_AUTH_STORAGE_STATE required for live dashboard boundaries')
      test.skip(isProductionTarget, 'Authenticated E2E refuses production hosts')
      test.use(storageState ? { storageState } : {})

      test('boundary never renders empty/undefined/NaN text and uses skeleton primitives', async ({ page }) => {
        // Hold API responses so the loading boundary is observable.
        await page.route('**/api/**', async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 600))
          await route.continue()
        })

        await page.goto(resolveRoute(route))
        const samples = await sampleLoadingShell(page, 4000, 60)

        expect(samples.length, 'loading boundary was observed while the route mounted').toBeGreaterThan(0)
        expect(samples.some((sample) => sample.badText), `undefined/NaN leaked while ${route} mounted`).toBe(false)

        const skeletonShots = samples.filter((sample) => sample.pulseCount > 0)
        if (skeletonShots.length === 0) {
          test.info().annotations.push({
            type: 'note',
            description: 'skeleton primitives were not observable during this boundary load',
          })
        } else {
          expect(
            skeletonShots.every((shot) => !shot.wholePagePulse),
            `${route} skeleton is composed of atomic primitives, not a whole-page pulse`,
          ).toBe(true)
          const maxPulseRatio = Math.max(...skeletonShots.map((shot) => shot.maxPulseRatio))
          expect(maxPulseRatio, `single skeleton block on ${route} covers most of the viewport`).toBeLessThan(0.9)
        }

        await expect(page.locator('body'), `${route} boundary leaves an empty document`).not.toBeEmpty()
        await expect(page.locator('body'), `${route} boundary renders raw undefined/NaN after settling`).not.toContainText(
          /undefined|NaN/,
        )
      })
    })
  }
})

test.describe('public surface loading integrity', () => {
  for (const route of publicSurfaces) {
    test(`${route} never renders empty or undefined/NaN text`, async ({ page, assertPageReady }) => {
      await assertPageReady(resolveRoute(route))
      await expect(page.locator('body')).not.toBeEmpty()
      await expect(page.locator('body')).not.toContainText(/undefined|NaN/)
    })
  }
})