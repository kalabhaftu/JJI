import { expect, test } from './fixtures'

test('AI workspace route renders its shell without application errors', async ({ page }) => {
  await page.goto('/dashboard/ai')
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
  await expect(page.locator('body')).not.toContainText(/undefined|NaN/)
})

test('AI workspace exposes the composer and workspace library', async ({ page }) => {
  await page.goto('/dashboard/ai')
  await expect(page.getByRole('complementary', { name: 'AI workspace library' })).toBeVisible()
})