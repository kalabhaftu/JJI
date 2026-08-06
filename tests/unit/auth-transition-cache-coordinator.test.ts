import { beforeEach, describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  createAuthTransitionCacheCoordinator,
  runAuthTransition,
} from '@/lib/query/auth-transition-cache'
import { queryKeys } from '@/lib/query/query-keys'
import type { QueryScope } from '@/lib/query/query-scope'

const userScope: QueryScope = { surface: 'authenticated', userId: 'user-1' }

function installLocalStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  })
}

describe('auth-transition cache coordinator', () => {
  beforeEach(() => {
    installLocalStorage()
  })

  it('clears scoped query cache entries for a prefetched user scope', async () => {
    const queryClient = new QueryClient()
    const tradesKey = queryKeys.trades(userScope, { symbol: 'ES' })
    const accountsKey = queryKeys.accounts(userScope, {})

    queryClient.setQueryData(tradesKey, [{ id: 'trade-1' }])
    queryClient.setQueryData(accountsKey, [{ id: 'account-1' }])

    const coordinator = createAuthTransitionCacheCoordinator({ queryClient })
    await runAuthTransition(coordinator, 'user-2')

    expect(queryClient.getQueryData(tradesKey)).toBeUndefined()
    expect(queryClient.getQueryData(accountsKey)).toBeUndefined()
  })

  it('purges the private persisted state without removing unrelated storage', async () => {
    window.localStorage.setItem('jji_user_data', JSON.stringify({ id: 'user-1' }))
    window.localStorage.setItem('unrelated_key', 'keep')

    const coordinator = createAuthTransitionCacheCoordinator({
      queryClient: new QueryClient(),
    })
    await runAuthTransition(coordinator, null)

    expect(window.localStorage.getItem('jji_user_data')).toBeNull()
    expect(window.localStorage.getItem('unrelated_key')).toBe('keep')
  })

  it('is idempotent for a second call', async () => {
    const queryClient = new QueryClient()
    const journalKey = queryKeys.journal(userScope, {})

    queryClient.setQueryData(journalKey, { entries: [] })
    window.localStorage.setItem('jji_user_data', JSON.stringify({ id: 'user-1' }))

    const coordinator = createAuthTransitionCacheCoordinator({ queryClient })
    await runAuthTransition(coordinator, null)
    await runAuthTransition(coordinator, null)

    expect(queryClient.getQueryData(journalKey)).toBeUndefined()
    expect(window.localStorage.getItem('jji_user_data')).toBeNull()
  })
})