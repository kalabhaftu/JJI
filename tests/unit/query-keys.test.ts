import { describe, expect, it } from 'vitest'

import { queryKeys, queryKeyPrefixes } from '@/lib/query/query-keys'
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

  it('keeps data-management keys scoped and prefix-invalidatable', () => {
    expect(queryKeys.dataManagementAccounts(authenticatedScope)).not.toEqual(
      queryKeys.dataManagementAccounts(demoScope),
    )
    expect(queryKeys.dataExportOptions(authenticatedScope)).not.toEqual(queryKeys.dataExportOptions(demoScope))

    const pageTwo = queryKeys.dataManagementTrades(authenticatedScope, { page: 2, limit: 25 })
    expect(pageTwo).not.toEqual(queryKeys.dataManagementTrades(authenticatedScope, { page: 1, limit: 25 }))

    const prefix = queryKeyPrefixes.dataManagementTrades(authenticatedScope)
    expect(pageTwo.slice(0, prefix.length)).toEqual(prefix)
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
      () => queryKeys.propFirmAccount(authenticatedScope, 'account-1'),
      () => queryKeys.propFirmAccount(authenticatedScope, 'account-1', { resetTimezone: 'America/New_York' }),
      () => queryKeys.propFirmStats(authenticatedScope),
      () => queryKeys.payouts(authenticatedScope, {}),
      () => queryKeys.settings(authenticatedScope),
      () => queryKeys.dataManagementAccounts(authenticatedScope),
      () => queryKeys.dataManagementTrades(authenticatedScope, { page: 1, limit: 25 }),
      () => queryKeys.dataExportOptions(authenticatedScope),
    ]

    for (const factory of factories) {
      expect(factory()).toContain(authenticatedScope)
    }
  })

  it('keeps resetTimezone filters in propFirmAccount key identity without breaking prefix invalidation', () => {
    const base = queryKeys.propFirmAccount(authenticatedScope, 'account-1')
    const filtered = queryKeys.propFirmAccount(authenticatedScope, 'account-1', { resetTimezone: 'America/New_York' })

    expect(filtered).toEqual([...base, { resetTimezone: 'America/New_York' }])
    expect(queryKeys.propFirmAccount(authenticatedScope, 'account-1', { resetTimezone: 'UTC' })).not.toEqual(base)
    expect(filtered).not.toEqual(queryKeys.propFirmAccount(demoScope, 'account-1', { resetTimezone: 'America/New_York' }))

    const prefix = queryKeyPrefixes.propFirmAccounts(authenticatedScope)
    expect(filtered.slice(0, prefix.length)).toEqual(prefix)
    expect(base.slice(0, prefix.length)).toEqual(prefix)
  })
})
