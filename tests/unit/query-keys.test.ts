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

  it('includes scope in every supported query key', () => {
    const factories = [
      () => queryKeys.accounts(authenticatedScope, {}),
      () => queryKeys.trades(authenticatedScope, {}),
      () => queryKeys.journal(authenticatedScope, {}),
      () => queryKeys.tags(authenticatedScope),
      () => queryKeys.templates(authenticatedScope),
      () => queryKeys.reportStats(authenticatedScope, {}),
      () => queryKeys.notifications(authenticatedScope),
    ]

    for (const factory of factories) {
      expect(factory()).toContain(authenticatedScope)
    }
  })
})
