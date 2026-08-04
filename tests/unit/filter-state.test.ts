import { describe, expect, it } from 'vitest'

import { decodeFilterState, encodeFilterState, reconcileFilterQuery } from '@/lib/filters/filter-state'

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

  it('tracks rapid local URL requests, including out-of-order commits', () => {
    const initial = { committedQuery: 'tab=trades', requestedQueries: [] }
    const first = reconcileFilterQuery('tab=trades', 'tab=trades&side=buy', initial)
    const second = reconcileFilterQuery('tab=trades', 'tab=trades&side=sell', first.state)
    const newer = reconcileFilterQuery('tab=trades&side=sell', 'tab=trades&side=sell', second.state)
    expect(newer.action).toBe('none')
    expect(newer.state.requestedQueries).toEqual(['tab=trades&side=buy'])
    const older = reconcileFilterQuery('tab=trades&side=buy', 'tab=trades&side=buy', newer.state)
    expect(older.action).toBe('none')
    expect(older.state.requestedQueries).toEqual([])
  })
})
