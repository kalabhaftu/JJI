import { expect, test } from './fixtures'
import {
  AUTH_STORAGE_STATE,
  allSelectedRoutes,
  assertNoPageOverflow,
  assertPrimaryContentVisible,
  assertPrimaryTouchTargets,
  assertStickyActionsWithinViewport,
  doesEmulateCoarsePointer,
  emulate200PercentTextZoom,
  familyRepresentative,
  focusControlInsideViewport,
  isRefusedProductionTarget,
  requiresAuthentication,
  resolveRoute,
  selectedRoutes,
  viewports,
} from './responsive-helpers'

const storageState = AUTH_STORAGE_STATE
const isProductionTarget = isRefusedProductionTarget()

test.setTimeout(120_000)

// Applies the auth gate to a route family: live dashboard routes require an
// explicit preview storage state and refuse production hosts.
function gateAuthenticatedFamilies(route: string) {
  if (!requiresAuthentication(route)) return
  test.skip(!storageState, 'PLAYWRIGHT_AUTH_STORAGE_STATE required for live dashboard routes')
  test.skip(isProductionTarget, 'Authenticated E2E refuses production hosts')
  test.use(storageState ? { storageState } : {})
}

// Shared scenario list: one representative route per family runs the full
// viewport grid; every selected exact route is still swept at 320px below so
// no route wrapper is left uncovered while identical tests are not duplicated.
test.describe('responsive/visual viewport grid', () => {
  for (const [family, routes] of Object.entries(selectedRoutes)) {
    const representative = familyRepresentative[family]
    test.describe(`family: ${family}`, () => {
      gateAuthenticatedFamilies(representative)

      for (const viewport of viewports) {
        test(`${representative} renders ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page, assertPageReady }) => {
          test.info().annotations.push({
            type: 'covered-routes',
            description: `this family-level scenario covers: ${routes.join(' | ')}`,
          })
          await page.setViewportSize({ width: viewport.width, height: viewport.height })
          await assertPageReady(resolveRoute(representative))
          await assertPrimaryContentVisible(
            page,
            (length) => expect(length, 'main landmark missing but body has content').toBeGreaterThan(0),
          )
          await assertNoPageOverflow(page, `${family}@${viewport.name}`)
        })
      }
    })
  }
})

// Exact-route sweep at the narrowest breakpoint: every selected route from the
// plan is checked for local overflow, content visibility, and sticky focus on
// a mobile viewport regardless of wrapper/shared layout.
test.describe('selected exact routes at 320px', () => {
  for (const route of allSelectedRoutes) {
    test.describe(`route ${route}`, () => {
      gateAuthenticatedFamilies(route)

      test(`overflow safe, content visible, sticky focus kept`, async ({ page, assertPageReady }) => {
        await page.setViewportSize({ width: 320, height: 900 })
        await assertPageReady(resolveRoute(route))
        await assertPrimaryContentVisible(page)
        await assertNoPageOverflow(page, route)
        await focusControlInsideViewport(page)
      })
    })
  }
})

// Dynamic viewport round trip: mobile -> desktop -> mobile must not break the
// layout or force horizontal scrolling.
test.describe('dynamic viewport round-trip', () => {
  for (const [family, representative] of Object.entries(familyRepresentative)) {
    test.describe(`family: ${family}`, () => {
      gateAuthenticatedFamilies(representative)

      test('no broken layout when resizing mobile -> desktop -> mobile', async ({ page, assertPageReady }) => {
        await page.setViewportSize({ width: 375, height: 900 })
        await assertPageReady(resolveRoute(representative))
        await assertPrimaryContentVisible(page)
        await assertNoPageOverflow(page, `${family}-mobile`)

        await page.setViewportSize({ width: 1600, height: 1000 })
        await assertNoPageOverflow(page, `${family}-desktop`)
        await assertPrimaryContentVisible(page)

        await page.setViewportSize({ width: 375, height: 900 })
        await assertNoPageOverflow(page, `${family}-back-to-mobile`)
        await assertPrimaryContentVisible(page)
      })
    })
  }
})

test.describe('coarse pointer touch targets', () => {
  test.use({ viewport: { width: 375, height: 900 }, hasTouch: true, isMobile: true })

  for (const [family, representative] of Object.entries(familyRepresentative)) {
    test.describe(`family: ${family}`, () => {
      gateAuthenticatedFamilies(representative)

      test('primary touch targets are at least 44x44', async ({ page, assertPageReady }) => {
        await assertPageReady(resolveRoute(representative))
        const coarse = await doesEmulateCoarsePointer(page)
        test.skip(!coarse, 'browser does not emulate a coarse pointer in this context')
        await assertPrimaryTouchTargets(page)
      })
    })
  }
})

test.describe('200% text zoom', () => {
  test.use({ viewport: { width: 1600, height: 1000 } })

  for (const [family, representative] of Object.entries(familyRepresentative)) {
    test.describe(`family: ${family}`, () => {
      gateAuthenticatedFamilies(representative)

      test('main content, focused controls, and sticky actions stay visible', async ({ page, assertPageReady }) => {
        await assertPageReady(resolveRoute(representative))
        await emulate200PercentTextZoom(page)
        await assertPrimaryContentVisible(page)
        await focusControlInsideViewport(page)
        await assertStickyActionsWithinViewport(page)
      })
    })
  }
})