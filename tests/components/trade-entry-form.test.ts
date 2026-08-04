import { describe, expect, it } from 'vitest'

import { tradeEntryFormSchema } from '@/app/dashboard/trades/new/trade-entry-schema'

describe('trade entry validation', () => {
  it('requires account, instrument, execution, and timing fields', () => {
    const result = tradeEntryFormSchema.safeParse({})

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        accountNumber: expect.any(Array), instrument: expect.any(Array), side: expect.any(Array), quantity: expect.any(Array),
        entryPrice: expect.any(Array), closePrice: expect.any(Array), entryDate: expect.any(Array), entryTime: expect.any(Array),
        closeDate: expect.any(Array), closeTime: expect.any(Array),
      })
    }
  })

  it('accepts the normalized domain values used by the import API', () => {
    const result = tradeEntryFormSchema.safeParse({
      accountNumber: 'acct-1', instrument: 'NQ', side: 'LONG', quantity: 1,
      entryPrice: '20000', closePrice: '20020', entryDate: '2026-08-04', entryTime: '09:30',
      closeDate: '2026-08-04', closeTime: '10:00', pnl: 20, commission: 0, isMissedTrade: false,
    })

    expect(result.success).toBe(true)
  })
})
