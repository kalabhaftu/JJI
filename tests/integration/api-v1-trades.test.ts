
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/user-identity', () => ({
  getResolvedUserIdentity: vi.fn().mockResolvedValue({
    authUserId: 'test-auth-user-id',
    internalUserId: 'internal-user-id',
  }),
}))

vi.mock('@/lib/db/client', () => ({
  db: {
    query: {
      Trade: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      Account: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      PhaseAccount: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      MasterAccount: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      User: {
        findFirst: vi.fn().mockResolvedValue({ breakEvenThreshold: 10 }),
      },
      UserSettings: {
        findFirst: vi.fn().mockResolvedValue({ breakEvenThreshold: 10, pnlDisplayMode: 'net' }),
      },
    },
  },
}))

vi.mock('@/lib/rate-limiter', () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
  apiLimiter: {},
}))

describe('GET /api/v1/trades', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    const { getResolvedUserIdentity } = await import('@/server/user-identity')
    vi.mocked(getResolvedUserIdentity).mockRejectedValueOnce(new Error('not authenticated'))

    const { GET } = await import('@/app/api/v1/trades/route')
    const request = { nextUrl: new URL('http://localhost/api/v1/trades') } as any
    const response = await GET(request)

    expect(response.status).toBe(401)
  }, 10000) // Increase timeout to 10s to prevent compilation flakiness on first test

  it('returns 404 when user is not found in database', async () => {
    const { getResolvedUserIdentity } = await import('@/server/user-identity')
    vi.mocked(getResolvedUserIdentity).mockRejectedValueOnce(new Error('User not found'))

    const { GET } = await import('@/app/api/v1/trades/route')
    const request = { nextUrl: new URL('http://localhost/api/v1/trades') } as any
    const response = await GET(request)

    expect(response.status).toBe(404)
  })

  it('returns trades with statistics and calendarData when includeStats and includeCalendar are true', async () => {
    const { db } = await import('@/lib/db/client')
    vi.mocked(db.query.Trade.findMany).mockResolvedValueOnce([
      {
        id: 't1',
        userId: 'internal-user-id',
        accountNumber: '123',
        instrument: 'EURUSD',
        entryPrice: '1.1',
        closePrice: '1.11',
        entryDate: '2024-01-01',
        closeDate: '2024-01-01',
        pnl: 100,
        commission: 0,
        timeInPosition: 3600,
        quantity: 1,
        side: 'BUY',
        stopLoss: null,
        takeProfit: null,
        TradingModel: { id: 'm1', name: 'Model 1' },
      } as any,
    ])
    vi.mocked(db.query.Account.findMany).mockResolvedValueOnce([
      { id: 'a1', number: '123', _count: { Trade: 1 } } as any,
    ])
    vi.mocked(db.query.MasterAccount.findMany).mockResolvedValueOnce([])
    vi.mocked(db.query.UserSettings.findFirst).mockResolvedValueOnce({ breakEvenThreshold: 12, pnlDisplayMode: 'net' } as any)

    const { GET } = await import('@/app/api/v1/trades/route')
    const url = new URL('http://localhost/api/v1/trades')
    const request = { nextUrl: url } as any
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('trades')
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('statistics')
    expect(data).toHaveProperty('calendarData')
    expect(Array.isArray(data.trades)).toBe(true)
    expect(data.total).toBe(1)
    expect(data.breakEvenThreshold).toBe(12)
  })

  it('applies account filter when accounts param is provided', async () => {
    const { db } = await import('@/lib/db/client')
    vi.mocked(db.query.Trade.findMany).mockResolvedValueOnce([])
    vi.mocked(db.query.Account.findMany).mockResolvedValueOnce([])
    vi.mocked(db.query.PhaseAccount.findMany).mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/v1/trades/route')
    const url = new URL('http://localhost/api/v1/trades?accounts=123,456')
    const request = { nextUrl: url } as any
    await GET(request)

    expect(db.query.Trade.findMany).toHaveBeenCalled()
  })

  it('applies outcome filter using user threshold', async () => {
    const { db } = await import('@/lib/db/client')
    vi.mocked(db.query.UserSettings.findFirst).mockResolvedValueOnce({ breakEvenThreshold: 25, pnlDisplayMode: 'net' } as any)
    vi.mocked(db.query.Trade.findMany).mockResolvedValueOnce([
      {
        id: 'w1',
        userId: 'internal-user-id',
        accountNumber: '123',
        instrument: 'US100',
        entryPrice: '1',
        closePrice: '2',
        entryDate: '2024-01-01',
        closeDate: '2024-01-01',
        pnl: 40,
        commission: 5,
        timeInPosition: 100,
        quantity: 1,
        side: 'BUY',
      } as any,
      {
        id: 'be1',
        userId: 'internal-user-id',
        accountNumber: '123',
        instrument: 'US100',
        entryPrice: '1',
        closePrice: '2',
        entryDate: '2024-01-02',
        closeDate: '2024-01-02',
        pnl: 20,
        commission: -10,
        timeInPosition: 100,
        quantity: 1,
        side: 'BUY',
      } as any,
    ])

    const { GET } = await import('@/app/api/v1/trades/route')
    const url = new URL('http://localhost/api/v1/trades?outcome=win')
    const request = { nextUrl: url } as any
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.total).toBe(1)
    expect(data.trades[0].id).toBe('w1')
  })
})
