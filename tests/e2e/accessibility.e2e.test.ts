import { expect, publicRoutes, test } from './fixtures'

for (const route of publicRoutes) {
  test(`public accessibility landmarks: ${route}`, async ({ page, assertPageReady }) => {
    await assertPageReady(route)
    await expect(page.locator('main, [role="main"]').first()).toBeVisible()
    await expect(page.locator('button:not([aria-label]):not(:has-text("."))').filter({ hasText: /^\s*$/ })).toHaveCount(0)
  })
}
