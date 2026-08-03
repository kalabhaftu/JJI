import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/v1/import/webhook/tradingview/route'
import { db } from '@/lib/db/client'

vi.mock('@/lib/db/client', () => ({
  db: {
    query: {
      UserSettings: {
        findFirst: vi.fn(),
      },
    Account: {
      findFirst: vi.fn(),
    },
    },
    transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback({
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([{}]) })),
    })),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([{}]) })),
  },
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
  webhookLimiter: {},
}))

describe('POST /api/v1/import/webhook/tradingview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('successfully processes valid payload and creates a trade', async () => {
    vi.mocked(db.query.UserSettings.findFirst).mockResolvedValueOnce({
      userId: 'test-user-id',
    } as any)
    vi.mocked(db.query.Account.findFirst).mockResolvedValueOnce({
      id: 'test-account-id',
      number: 'ACC123',
    } as any)
    
    const payload = {
      token: 'e7057f7c-297e-4e16-add8-23ec2166e305',
      symbol: 'EURUSD',
      side: 'BUY',
      entry_price: 1.0850,
      close_price: 1.0920,
      quantity: 0.1,
      pnl: 70.00,
      entry_time: '2026-05-07T14:30:00Z',
      close_time: '2026-05-07T18:45:00Z',
    }

    const request = new Request('http://localhost/api/v1/import/webhook/tradingview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }) as any

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(db.transaction).toHaveBeenCalled()
  })

  it('successfully processes flexible date formats from TradingView', async () => {
    vi.mocked(db.query.UserSettings.findFirst).mockResolvedValueOnce({
      userId: 'test-user-id',
    } as any)
    vi.mocked(db.query.Account.findFirst).mockResolvedValueOnce({
      id: 'test-account-id',
      number: 'ACC123',
    } as any)
    
    const payload = {
      token: 'e7057f7c-297e-4e16-add8-23ec2166e305',
      symbol: 'EURUSD',
      side: 'BUY',
      entry_price: 1.0850,
      close_price: 1.0920,
      entry_time: '2026-05-07T14:30:00',
      close_time: '2026-05-07 18:45:00',
    }

    const request = new Request('http://localhost/api/v1/import/webhook/tradingview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }) as any

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(db.transaction).toHaveBeenCalled()
  })

  it('successfully authenticates with token in query params instead of body', async () => {
    vi.mocked(db.query.UserSettings.findFirst).mockResolvedValueOnce({
      userId: 'test-user-id',
    } as any)
    vi.mocked(db.query.Account.findFirst).mockResolvedValueOnce({
      id: 'test-account-id',
      number: 'ACC123',
    } as any)
    

    const payload = {
      symbol: 'EURUSD',
      side: 'BUY',
      entry_price: 1.0850,
      close_price: 1.0920,
      entry_time: '2026-05-07T14:30:00Z',
      close_time: '2026-05-07T18:45:00Z',
    }

    const request = new Request('http://localhost/api/v1/import/webhook/tradingview?token=e7057f7c-297e-4e16-add8-23ec2166e305', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }) as any

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(db.transaction).toHaveBeenCalled()
  })
})
