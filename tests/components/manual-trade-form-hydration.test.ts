import { describe, expect, it } from 'vitest'

import { getManualTradeFormDefaults } from '@/app/dashboard/components/import/manual-trade-entry/manual-trade-form'

describe('manual trade draft hydration', () => {
  it('merges restored values over fresh defaults for react-hook-form reset', () => {
    const defaults = getManualTradeFormDefaults({ instrument: 'NQ', accountNumber: 'acct-1', quantity: 2 })

    expect(defaults).toMatchObject({ instrument: 'NQ', accountNumber: 'acct-1', quantity: 2, commission: 0, isMissedTrade: false })
  })
})
