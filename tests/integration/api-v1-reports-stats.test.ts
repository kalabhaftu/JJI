

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getResolvedUserIdentitySafe } = vi.hoisted(() => ({
  getResolvedUserIdentitySafe: vi.fn(),
}))

vi.mock('@/server/user-identity', () => ({
  getResolvedUserIdentitySafe,
}))

getResolvedUserIdentitySafe.mockResolvedValue({
    authUserId: 'auth-user-id',
    internalUserId: 'internal-user-id',
})

vi.mock('@/lib/statistics/report-statistics', () => ({
  calculateReportStatistics: vi.fn().mockResolvedValue({
    tradingActivity: { totalTrades: 0, winningTrades: 0, losingTrades: 0 },
    psychMetrics: {},
    sessionPerformance: {},
    rMultipleDistribution: {},
  }),
}))

vi.mock('@/lib/rate-limiter', () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
  apiLimiter: {},
  adminLimiter: {},
  accountDeletionLimiter: {},
  aiLimiter: {},
  authenticatedReadLimiter: {},
  authLimiter: {},
  errorReportLimiter: {},
  feedbackLimiter: {},
  importLimiter: {},
  paymentLimiter: {},
  publicLimiter: {},
  sensitiveMutationLimiter: {},
  uploadLimiter: {},
}))

vi.mock('@/lib/db/client', () => ({
  db: {
    query: {
      User: {
        findFirst: vi.fn().mockResolvedValue({ id: 'internal-user-id' }),
      },
    },
  },
}))

describe('POST /api/v1/reports/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getResolvedUserIdentitySafe.mockResolvedValue({
      authUserId: 'auth-user-id',
      internalUserId: 'internal-user-id',
    })
  })

  it('returns 401 when user is not authenticated', async () => {
    getResolvedUserIdentitySafe.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/v1/reports/stats/route')
    const request = new Request('http://localhost/api/v1/reports/stats', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request as any)

    expect(response.status).toBe(401)
  })

  it('calls calculateReportStatistics with filters from request body', async () => {
    const { calculateReportStatistics } = await import('@/lib/statistics/report-statistics')

    const { POST } = await import('@/app/api/v1/reports/stats/route')
    const request = new Request('http://localhost/api/v1/reports/stats', {
      method: 'POST',
      body: JSON.stringify({
        accountId: 'acc-1',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        symbol: 'EURUSD',
      }),
    })
    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(calculateReportStatistics).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'internal-user-id',
        accountId: 'acc-1',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        symbol: 'EURUSD',
      })
    )
  })

  it('returns report statistics DTO', async () => {
    const mockResult = {
      tradingActivity: { totalTrades: 42, winningTrades: 25, losingTrades: 17 },
      psychMetrics: { winRate: 59.5 },
      sessionPerformance: {},
      rMultipleDistribution: {},
    }
    const { calculateReportStatistics } = await import('@/lib/statistics/report-statistics')
    vi.mocked(calculateReportStatistics).mockResolvedValueOnce(mockResult as any)

    const { POST } = await import('@/app/api/v1/reports/stats/route')
    const request = new Request('http://localhost/api/v1/reports/stats', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.tradingActivity.totalTrades).toBe(42)
    expect(data.data.psychMetrics.winRate).toBe(59.5)
  })
})
