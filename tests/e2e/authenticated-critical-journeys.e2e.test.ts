import { expect, test } from '@playwright/test'

const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3000'
const storageState = process.env.PLAYWRIGHT_AUTH_STORAGE_STATE
const testAccountPrefix = process.env.PLAYWRIGHT_TEST_ACCOUNT_PREFIX ?? 'e2e-jji'
const isProductionTarget = /(?:^|\.)justjournalit\.site$/i.test(new URL(baseUrl).hostname)

test.describe('authenticated critical journeys', () => {
  test.skip(!storageState, 'PLAYWRIGHT_AUTH_STORAGE_STATE is required')
  test.skip(isProductionTarget, 'Authenticated E2E refuses production hosts')
  test.use(storageState ? { storageState } : {})

  test('dashboard loads metrics and supports inherited recovery UI', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText(/Net Daily P\/L|Account Balance|No trades/i).first()).toBeVisible()
  })

  test('account create, edit, and delete round trip', async ({ request }) => {
    const unique = `${testAccountPrefix}-${Date.now()}`
    const created = await request.post('/api/v1/accounts', {
      data: {
        number: unique,
        name: unique,
        broker: 'E2E',
        startingBalance: 10_000,
      },
    })
    expect(created.status()).toBe(201)
    const createdBody = await created.json()
    const accountId = createdBody.data?.id
    expect(accountId).toBeTruthy()

    const updated = await request.patch(`/api/v1/accounts/${accountId}`, {
      data: { name: `${unique}-edited` },
    })
    expect(updated.ok()).toBeTruthy()
    expect((await updated.json()).data?.name).toBe(`${unique}-edited`)

    const removed = await request.delete(`/api/v1/accounts/${accountId}`)
    expect(removed.ok()).toBeTruthy()
    expect((await removed.json()).success).toBe(true)
  })

  test('standardized API errors surface a safe request reference', async ({ request }) => {
    const response = await request.post('/api/v1/trades/import/jobs', {
      data: { accountId: '', trades: [] },
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.requestId).toBe(response.headers()['x-request-id'])
    expect(JSON.stringify(body)).not.toMatch(/authorization|cookie|token/i)
  })
})
