import { expect, test } from './fixtures'

test('login workflow remains keyboard reachable', async ({ page, assertPageReady }) => {
  await assertPageReady('/login')
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()
})
