import { expect, test } from './fixtures'

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`public shell fits ${viewport.width}px`, async ({ page, assertPageReady }) => {
    await page.setViewportSize(viewport)
    await assertPageReady('/')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
}
