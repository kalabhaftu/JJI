import { expect, test } from './fixtures'

test('playbook route exposes the strategy shell without rendering application errors', async ({ page }) => {
  await page.goto('/dashboard/playbook')
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
  await expect(page.locator('body')).not.toContainText(/undefined|NaN/)
  await expect(page.getByRole('heading', { name: /Strategy Playbook/i })).toBeVisible()
})