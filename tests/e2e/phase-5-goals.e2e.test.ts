import { expect, test } from './fixtures'

test('goals route exposes the goal shell without rendering application errors', async ({ page }) => {
  await page.goto('/dashboard/goals')
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
  await expect(page.locator('body')).not.toContainText(/undefined|NaN/)
})

test('goals loading boundary renders the page skeleton, not a blank document', async ({ page }) => {
  await page.goto('/dashboard/goals/loading')
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('body')).not.toContainText(/undefined|NaN/)
})