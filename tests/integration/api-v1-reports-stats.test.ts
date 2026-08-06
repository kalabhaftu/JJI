

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
  calculateDashboardAggregates: vi.fn().mockResolvedValue({
    pnl: { value: 0, formatted: '$0.00' },
    winRate: { value: 0, formatted: '0.0%' },
    drawdown: { value: 0, formatted: '$0.00' },
    tradeCount: 0,
    dataQuality: 'current',
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

describe('POST /api/v1/reports/stats (dashboard aggregates)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getResolvedUserIdentitySafe.mockResolvedValue({
      authUserId: 'auth-user-id',
      internalUserId: 'internal-user-id',
    })
  })

  it('routes a dashboard: true request to calculateDashboardAggregates', async () => {
    const { calculateDashboardAggregates } = await import('@/lib/statistics/report-statistics')

    const { POST } = await import('@/app/api/v1/reports/stats/route')
    const request = new Request('http://localhost/api/v1/reports/stats', {
      method: 'POST',
      body: JSON.stringify({
        dashboard: true,
        accountIds: ['acc-1', 'acc-2'],
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-31T00:00:00.000Z',
        timezone: 'America/New_York',
        includeFees: true,
        currency: 'EUR',
      }),
    })
    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(calculateDashboardAggregates).toHaveBeenCalledWith({
      userId: 'internal-user-id',
      accountIds: ['acc-1', 'acc-2'],
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-01-31T00:00:00.000Z',
      timezone: 'America/New_York',
      includeFees: true,
      currency: 'EUR',
    })
  })

  it('defaults missing dashboard aggregate filters to full range and no fees', async () => {
    const { calculateDashboardAggregates } = await import('@/lib/statistics/report-statistics')

    const { POST } = await import('@/app/api/v1/reports/stats/route')
    const request = new Request('http://localhost/api/v1/reports/stats', {
      method: 'POST',
      body: JSON.stringify({ dashboard: true }),
    })
    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(calculateDashboardAggregates).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'internal-user-id',
        accountIds: [],
        from: '1970-01-01',
        to: '2099-12-31',
        timezone: 'UTC',
        includeFees: false,
      })
    )
  })

  it('returns the bounded aggregates contract with partial data quality', async () => {
    const partialAggregates = {
      pnl: { value: 4820.35, formatted: '$4,820.35' },
      winRate: { value: 58.3, formatted: '58.3%' },
      drawdown: { value: 640.2, formatted: '$640.20' },
      tradeCount: 24,
      dataQuality: 'partial',
    }
    const { calculateDashboardAggregates } = await import('@/lib/statistics/report-statistics')
    vi.mocked(calculateDashboardAggregates).mockResolvedValueOnce(partialAggregates as any)

    const { POST } = await import('@/app/api/v1/reports/stats/route')
    const request = new Request('http://localhost/api/v1/reports/stats', {
      method: 'POST',
      body: JSON.stringify({ dashboard: true, accountIds: ['acc-1', 'acc-2'] }),
    })
    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toEqual(partialAggregates)
  })

  it('does not ship trade rows in the aggregates contract', async () => {
    const { calculateDashboardAggregates } = await import('@/lib/statistics/report-statistics')
    vi.mocked(calculateDashboardAggregates).mockResolvedValueOnce({
      pnl: { value: 1, formatted: '$1.00' },
      winRate: { value: 50, formatted: '50.0%' },
      drawdown: { value: 0, formatted: '$0.00' },
      tradeCount: 2,
      dataQuality: 'current',
    } as any)

    const { POST } = await import('@/app/api/v1/reports/stats/route')
    const request = new Request('http://localhost/api/v1/reports/stats', {
      method: 'POST',
      body: JSON.stringify({ dashboard: true, includeFees: false }),
    })
    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.trades).toBeUndefined()
    expect(data.data.filteredTrades).toBeUndefined()
  })
})
