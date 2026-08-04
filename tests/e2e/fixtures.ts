import { expect, test as base } from '@playwright/test'

export const publicRoutes = ['/', '/login', '/docs', '/donate'] as const
export const demoRoutes = ['/demo', '/demo/reports', '/demo/journal'] as const

export const test = base.extend<{ assertPageReady: (path: string) => Promise<void> }>({
  assertPageReady: async ({ page }, provide) => {
    await provide(async (path) => {
      await page.goto(path)
      await expect(page.locator('body')).toBeVisible()
      await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
    })
  },
})

export { expect }
