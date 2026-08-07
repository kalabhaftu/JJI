import { expect, test } from './fixtures'

const demoRoutes: Array<{ path: string; heading?: RegExp }> = [
  { path: '/demo' },
  { path: '/demo/accounts' },
  { path: '/demo/data' },
  { path: '/demo/goals' },
  { path: '/demo/journal' },
  { path: '/demo/playbook' },
  { path: '/demo/ai' },
  { path: '/demo/backtesting' },
]

for (const route of demoRoutes) {
  test(`demo route ${route.path} exposes its shell without production API calls or app errors`, async ({ page }) => {
    await page.goto(route.path)
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('body')).not.toBeEmpty()
    await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
    await expect(page.locator('body')).not.toContainText(/undefined|NaN/)
  })
}