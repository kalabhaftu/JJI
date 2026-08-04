import { expect, test } from './fixtures'

test.use({ reducedMotion: 'reduce' })

test('public surface remains usable with reduced motion', async ({ page, assertPageReady }) => {
  await assertPageReady('/')
  await expect(page.locator('body')).toBeVisible()
})
