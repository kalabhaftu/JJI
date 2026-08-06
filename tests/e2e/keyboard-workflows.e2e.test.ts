import type { TestInfo } from '@playwright/test'

import {
  DEFAULT_VIEWPORT,
  DEMO_PROP_FIRM_ACCOUNT_ID,
  MOBILE_VIEWPORT,
  describeScenario,
  expect,
  focusIsVisible,
  navigateRefusingProduction,
  tabUntilFocused,
  test,
} from './fixtures'

const FOCUS_LOOP_LIMIT = 80

async function attachScenario(
  testInfo: TestInfo,
  routeFamily: string,
  state: 'public' | 'demo' | 'authenticated',
  viewport: { width: number; height: number },
): Promise<void> {
  await testInfo.attach('scenario-metadata', {
    body: JSON.stringify(describeScenario(routeFamily, state, viewport, 'dark', 'classic'), null, 2),
    contentType: 'application/json',
  })
}

test('login form is keyboard reachable with visible focus', async ({ page }, testInfo) => {
  await attachScenario(testInfo, 'auth-login', 'public', DEFAULT_VIEWPORT)
  await navigateRefusingProduction(page, '/login')
  await expect(page.getByRole('main')).toBeVisible()

  const email = page.locator('input[type="email"]')
  await expect(email).toBeVisible()
  expect(await tabUntilFocused(page, email, FOCUS_LOOP_LIMIT)).toBe(true)
  expect(await focusIsVisible(page)).toBe(true)

  const sendCode = page.getByRole('button', { name: /send verification code/i })
  expect(await tabUntilFocused(page, sendCode, FOCUS_LOOP_LIMIT)).toBe(true)
  expect(await focusIsVisible(page)).toBe(true)

  await page.keyboard.press('Shift+Tab')
  await expect(email).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(email).toBeFocused()
  expect(await focusIsVisible(page)).toBe(true)
})

test('quick-add trade dialog opens and closes via keyboard', async ({ page }, testInfo) => {
  await attachScenario(testInfo, 'trade-entry-quick-add', 'demo', MOBILE_VIEWPORT)
  await page.setViewportSize({ width: 375, height: 900 })
  await navigateRefusingProduction(page, '/demo/table')

  const trigger = page.getByRole('button', { name: 'Add trade' })
  await expect(trigger).toBeVisible()
  expect(await tabUntilFocused(page, trigger, FOCUS_LOOP_LIMIT)).toBe(true)
  expect(await focusIsVisible(page)).toBe(true)

  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: /quick add trade/i })
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('report date filters open with the keyboard and recover focus', async ({ page }, testInfo) => {
  await attachScenario(testInfo, 'filters-calendar', 'demo', DEFAULT_VIEWPORT)
  await navigateRefusingProduction(page, '/demo/reports')

  const dateTrigger = page.getByRole('button', { name: /date range:/i })
  await expect(dateTrigger).toBeVisible()
  expect(await tabUntilFocused(page, dateTrigger, FOCUS_LOOP_LIMIT)).toBe(true)

  await page.keyboard.press('Enter')
  const presets = page.locator('[aria-label="Date range presets"]')
  await expect(presets).toBeVisible()
  expect(await focusIsVisible(page)).toBe(true)

  await page.keyboard.press('Escape')
  await expect(presets).toBeHidden()
  await expect(dateTrigger).toBeFocused()
})

test('payout request form controls retain visible focus under keyboard traversal', async ({ page }, testInfo) => {
  await attachScenario(testInfo, 'payout', 'demo', DEFAULT_VIEWPORT)
  await navigateRefusingProduction(
    page,
    `/demo/prop-firm/accounts/${DEMO_PROP_FIRM_ACCOUNT_ID}/payouts/request`,
  )
  await expect(page.locator('body')).toBeVisible()

  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Tab')
    expect(await focusIsVisible(page), `focus lost after Tab #${step + 1}`).toBe(true)
  }
  for (let step = 0; step < 5; step += 1) {
    await page.keyboard.press('Shift+Tab')
    expect(await focusIsVisible(page), `focus lost after Shift+Tab #${step + 1}`).toBe(true)
  }

  const amount = page.getByLabel('Amount ($)')
  if ((await amount.count()) > 0) {
    expect(await tabUntilFocused(page, amount, FOCUS_LOOP_LIMIT)).toBe(true)
    await page.keyboard.press('Shift+Tab')
    expect(await focusIsVisible(page)).toBe(true)
  }
})

test('AI workspace composer is reachable and retains focus', async ({ page }, testInfo) => {
  await attachScenario(testInfo, 'workspace-ai', 'demo', DEFAULT_VIEWPORT)
  await navigateRefusingProduction(page, '/demo/ai')

  const composer = page.locator('textarea').first()
  await expect(composer).toBeVisible()
  expect(await tabUntilFocused(page, composer, FOCUS_LOOP_LIMIT)).toBe(true)
  expect(await focusIsVisible(page)).toBe(true)

  await page.keyboard.type('test message')
  await expect(composer).toHaveValue(/test message/)

  await page.keyboard.press('Escape')
  await expect(composer).toBeFocused()
  expect(await focusIsVisible(page)).toBe(true)
})

test('account creation form opens through a keyboard-only dropdown flow', async ({ page }, testInfo) => {
  await attachScenario(testInfo, 'account-form', 'demo', DEFAULT_VIEWPORT)
  await navigateRefusingProduction(page, '/demo/accounts')

  const trigger = page.getByRole('button', { name: /new account/i })
  await expect(trigger).toBeVisible()
  expect(await tabUntilFocused(page, trigger, FOCUS_LOOP_LIMIT)).toBe(true)

  await page.keyboard.press('Enter')
  const liveItem = page.getByRole('menuitem', { name: /live account/i })
  await expect(liveItem).toBeVisible()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  expect(await focusIsVisible(page)).toBe(true)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('account deletion confirmation is reachable and cancellable via keyboard', async ({ page }, testInfo) => {
  await attachScenario(testInfo, 'deletion', 'demo', DEFAULT_VIEWPORT)
  await navigateRefusingProduction(page, '/demo/accounts')

  const options = page.getByRole('button', { name: 'Account options' }).first()
  await expect(options).toBeVisible()
  expect(await tabUntilFocused(page, options, FOCUS_LOOP_LIMIT)).toBe(true)

  await page.keyboard.press('Enter')
  const deleteItem = page.getByRole('menuitem', { name: 'Delete' }).first()
  await expect(deleteItem).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(deleteItem).toBeFocused()

  await page.keyboard.press('Enter')
  const confirmation = page.getByRole('alertdialog', { name: /delete account/i })
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole('button', { name: 'Delete Permanently' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(confirmation).toBeHidden()
  expect(await focusIsVisible(page)).toBe(true)
})

test('authenticated account form opens through keyboard when storage state exists', async (
  { authenticatedPage, hasAuthenticatedState },
  testInfo,
) => {
  test.skip(!hasAuthenticatedState, 'explicit PLAYWRIGHT_AUTH_STORAGE_STATE file required')
  await attachScenario(testInfo, 'authenticated-account-form', 'authenticated', DEFAULT_VIEWPORT)

  await navigateRefusingProduction(authenticatedPage, '/dashboard/accounts')
  const trigger = authenticatedPage.getByRole('button', { name: /new account/i })
  await expect(trigger).toBeVisible()
  expect(await tabUntilFocused(authenticatedPage, trigger, FOCUS_LOOP_LIMIT)).toBe(true)

  await authenticatedPage.keyboard.press('Enter')
  const liveItem = authenticatedPage.getByRole('menuitem', { name: /live account/i })
  await expect(liveItem).toBeVisible()
  await authenticatedPage.keyboard.press('Enter')

  const dialog = authenticatedPage.getByRole('dialog').first()
  await expect(dialog).toBeVisible()

  await authenticatedPage.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})