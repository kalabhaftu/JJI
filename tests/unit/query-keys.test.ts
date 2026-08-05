import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/lib/query/query-keys'
import type { QueryScope } from '@/lib/query/query-scope'

const authenticatedScope: QueryScope = { surface: 'authenticated', userId: 'user-1' }
const demoScope: QueryScope = { surface: 'demo' }

describe('query key factories', () => {
  it('keeps authenticated and demo account keys distinct', () => {
    expect(queryKeys.accounts(authenticatedScope, { status: 'active' })).not.toEqual(
      queryKeys.accounts(demoScope, { status: 'active' }),
    )
  })

  it('keeps authenticated users distinct from one another', () => {
    expect(queryKeys.trades(authenticatedScope, { symbol: 'ES' })).not.toEqual(
      queryKeys.trades({ surface: 'authenticated', userId: 'user-2' }, { symbol: 'ES' }),
    )
  })

  it('scopes prop-firm, payout, and settings state', () => {
    expect(queryKeys.propFirmAccounts(authenticatedScope)).not.toEqual(queryKeys.propFirmAccounts(demoScope))
    expect(queryKeys.propFirmStats(authenticatedScope)).not.toEqual(queryKeys.propFirmStats(demoScope))
    expect(queryKeys.payouts(authenticatedScope, { accountId: 'account-1' })).not.toEqual(
      queryKeys.payouts(demoScope, { accountId: 'account-1' }),
    )
    expect(queryKeys.settings(authenticatedScope)).not.toEqual(queryKeys.settings({ surface: 'authenticated', userId: 'user-2' }))
  })

  it('includes scope in every supported query key', () => {
    const factories = [
      () => queryKeys.accounts(authenticatedScope, {}),
      () => queryKeys.trades(authenticatedScope, {}),
      () => queryKeys.journal(authenticatedScope, {}),
      () => queryKeys.tags(authenticatedScope),
      () => queryKeys.templates(authenticatedScope),
      () => queryKeys.reportStats(authenticatedScope, {}),
      () => queryKeys.notifications(authenticatedScope),
      () => queryKeys.propFirmAccounts(authenticatedScope),
      () => queryKeys.propFirmStats(authenticatedScope),
      () => queryKeys.payouts(authenticatedScope, {}),
      () => queryKeys.settings(authenticatedScope),
    ]

    for (const factory of factories) {
      expect(factory()).toContain(authenticatedScope)
    }
  })
})
