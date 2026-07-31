import { test, expect } from '@playwright/test'

type RouteCheck = {
  name: string
  path: string
  method: 'GET' | 'POST'
  body?: unknown
}

const CORE_V1_ROUTE_CHECKS: RouteCheck[] = [
  { name: 'init', path: '/api/v1/init', method: 'GET' },
  { name: 'accounts', path: '/api/v1/accounts', method: 'GET' },
  { name: 'account detail', path: '/api/v1/accounts/test-id', method: 'GET' },
  { name: 'account trades', path: '/api/v1/accounts/test-id/trades', method: 'GET' },
  { name: 'adjust date', path: '/api/v1/accounts/test-id/adjust-date', method: 'POST', body: {} },
  { name: 'trades list', path: '/api/v1/trades', method: 'GET' },
  { name: 'trades quick add', path: '/api/v1/trades/quick-add', method: 'POST', body: {} },
  { name: 'trades import create job', path: '/api/v1/trades/import/jobs', method: 'POST', body: {} },
  { name: 'trades import job detail', path: '/api/v1/trades/import/jobs/test-id', method: 'GET' },
  { name: 'trades import job process', path: '/api/v1/trades/import/jobs/test-id/process', method: 'POST', body: {} },
  { name: 'trades import job cancel', path: '/api/v1/trades/import/jobs/test-id/cancel', method: 'POST', body: {} },
  { name: 'stats', path: '/api/v1/reports/stats', method: 'POST', body: {} },
  { name: 'propfirm stats', path: '/api/v1/reports/propfirm', method: 'GET' },
  { name: 'data export', path: '/api/v1/data/export', method: 'POST', body: {} },
  { name: 'data export options', path: '/api/v1/data/export/options', method: 'GET' },
  { name: 'restore import create job', path: '/api/v1/data/import/jobs', method: 'POST', body: {} },
  { name: 'restore import job detail', path: '/api/v1/data/import/jobs/test-id', method: 'GET' },
  { name: 'restore import job process', path: '/api/v1/data/import/jobs/test-id/process', method: 'POST', body: {} },
  { name: 'restore import job cancel', path: '/api/v1/data/import/jobs/test-id/cancel', method: 'POST', body: {} },
]

for (const route of CORE_V1_ROUTE_CHECKS) {
  test(`v1 route smoke: ${route.name}`, async ({ request }) => {
    const response =
      route.method === 'GET'
        ? await request.get(route.path)
        : await request.post(route.path, {
            headers: { 'Content-Type': 'application/json' },
            data: route.body ?? {},
          })

    expect(response.status(), `${route.method} ${route.path} should not be 404`).not.toBe(404)
  })
}
