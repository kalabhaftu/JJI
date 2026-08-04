import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildTradeEntryHref,
  clearTradeEntryDraft,
  loadTradeEntryDraft,
  parseTradeEntryRouteState,
  saveTradeEntryDraft,
  type TradeEntryDraft,
} from '@/app/dashboard/trades/new/trade-entry-draft'

describe('trade entry route state and drafts', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', { clear: () => data.clear(), getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) })
  })

  it('round-trips supported route state and encodes return paths', () => {
    const state = parseTradeEntryRouteState(new URLSearchParams('origin=table&accountId=a1&propFirmAccountId=p1&phaseId=ph1&draftId=d1&returnTo=%2Fdashboard%2Ftable%3Fview%3Dall'))

    expect(state).toEqual({ origin: 'table', accountId: 'a1', propFirmAccountId: 'p1', phaseId: 'ph1', draftId: 'd1', returnTo: '/dashboard/table?view=all' })
    expect(buildTradeEntryHref(state)).toBe('/dashboard/trades/new?origin=table&accountId=a1&propFirmAccountId=p1&phaseId=ph1&draftId=d1&returnTo=%2Fdashboard%2Ftable%3Fview%3Dall')
  })

  it('rejects external and protocol-relative return destinations', () => {
    expect(parseTradeEntryRouteState(new URLSearchParams('returnTo=https%3A%2F%2Fevil.example')).returnTo).toBeUndefined()
    expect(parseTradeEntryRouteState(new URLSearchParams('returnTo=%2F%2Fevil.example')).returnTo).toBeUndefined()
    expect(buildTradeEntryHref({ returnTo: 'https://evil.example' })).toBe('/dashboard/trades/new')
  })

  it('persists versioned drafts by user and draft id', () => {
    const draft: TradeEntryDraft = { version: 1, userId: 'u1', draftId: 'd1', updatedAt: 10, values: { instrument: 'NQ' } }

    saveTradeEntryDraft(draft)

    expect(loadTradeEntryDraft('u1', 'd1')).toEqual(draft)
    expect(loadTradeEntryDraft('u2', 'd1')).toBeNull()
    clearTradeEntryDraft('u1', 'd1')
    expect(loadTradeEntryDraft('u1', 'd1')).toBeNull()
  })

  it('ignores malformed and unsupported draft records', () => {
    localStorage.setItem('jji:trade-entry-draft:u1:d1', JSON.stringify({ version: 2, userId: 'u1', draftId: 'd1' }))
    expect(loadTradeEntryDraft('u1', 'd1')).toBeNull()
  })
})
