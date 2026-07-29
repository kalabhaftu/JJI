import { expect, test } from '@playwright/test'

const contractRoutes = [
  { path: '/api/v1/trades/import/jobs', method: 'POST' as const, body: {} },
  { path: '/api/v1/trades/batch/update', method: 'POST' as const, body: {} },
  { path: '/api/v1/trades/batch/delete', method: 'POST' as const, body: {} },
  { path: '/api/v1/dashboard/templates', method: 'POST' as const, body: {} },
  { path: '/api/v1/weekly-journal', method: 'PUT' as const, body: {} },
] as const

for (const route of contractRoutes) {
  test(`protected API contract: ${route.method} ${route.path}`, async ({ request }) => {
    const response = await request.fetch(route.path, {
      method: route.method,
      headers: { 'Content-Type': 'application/json' },
      data: route.body,
    })
    const body = await response.json()

    expect(response.status()).toBe(401)
    expect(response.headers()['x-request-id']).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
    expect(body).toMatchObject({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      },
    })
    expect(body.requestId).toBe(response.headers()['x-request-id'])
  })
}
