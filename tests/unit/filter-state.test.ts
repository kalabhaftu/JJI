import { describe, expect, it } from 'vitest'

import { decodeFilterState, encodeFilterState } from '@/lib/filters/filter-state'

describe('filter URL state', () => {
  it('round-trips dates and repeated selections without losing unrelated parameters', () => {
    const params = encodeFilterState({
      dateRange: { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) },
      instruments: ['ES', 'NQ'],
      accounts: ['primary'],
      side: 'buy',
      pnl: 'wins',
    }, new URLSearchParams('view=details'))

    expect(params.get('view')).toBe('details')
    expect(params.get('from')).toBe('2026-07-01')
    expect(params.getAll('instrument')).toEqual(['ES', 'NQ'])
    expect(decodeFilterState(params)).toEqual({
      dateRange: { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) },
      instruments: ['ES', 'NQ'],
      accounts: ['primary'],
      side: 'buy',
      pnl: 'wins',
    })
  })

  it('ignores invalid or incomplete filter values', () => {
    expect(decodeFilterState(new URLSearchParams('from=nope&to=2026-01-01&side=other&pnl=nope'))).toEqual({
      instruments: [],
      accounts: [],
      side: 'all',
      pnl: 'all',
    })
  })
})
