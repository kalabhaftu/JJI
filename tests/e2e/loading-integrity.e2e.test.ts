import { expect, test } from './fixtures'

test('dashboard navigation never exposes an empty document', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('body')).not.toContainText(/undefined|NaN/)
})
