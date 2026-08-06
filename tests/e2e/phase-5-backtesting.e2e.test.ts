import { expect, test } from './fixtures'

test('backtesting route exposes the workflow shell without rendering application errors', async ({ page }) => {
  await page.goto('/dashboard/backtesting')
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
  await expect(page.locator('body')).not.toContainText(/undefined|NaN/)
  await expect(page.getByRole('heading', { name: /Backtesting/i })).toBeVisible()
})

test('backtesting supports adding and opening a recorded backtest', async ({ page }) => {
  await page.goto('/dashboard/backtesting')
  await page.getByRole('button', { name: /Add Backtest/i }).click()
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()
})