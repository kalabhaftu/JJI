import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createAuthTransitionCacheCoordinator,
  isAuthIdentityChange,
  runAuthTransition,
} from '@/lib/query/auth-transition-cache'

function makeQueryClient() {
  return { clear: vi.fn(), cancelQueries: vi.fn() }
}

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

describe('auth transition cache coordinator', () => {
  beforeEach(() => {
    installLocalStorage()
    window.localStorage.setItem('jji_user_data', JSON.stringify({ id: 'user-1' }))
  })

  it('detects a user switch, a login, and a logout', () => {
    expect(isAuthIdentityChange('user-1', 'user-2')).toBe(true)
    expect(isAuthIdentityChange(null, 'user-1')).toBe(true)
    expect(isAuthIdentityChange('user-1', null)).toBe(true)
  })

  it('treats an unchanged identity as no transition', () => {
    expect(isAuthIdentityChange('user-1', 'user-1')).toBe(false)
    expect(isAuthIdentityChange(null, null)).toBe(false)
    expect(isAuthIdentityChange(undefined, null)).toBe(false)
  })

  it('clears every private cache when the identity changes', async () => {
    const queryClient = makeQueryClient()
    const clearModuleCaches = vi.fn()
    const clearProviderState = vi.fn()

    const coordinator = createAuthTransitionCacheCoordinator({
      queryClient: queryClient as never,
      clearModuleCaches,
      clearProviderState,
    })

    await runAuthTransition(coordinator, 'user-2')

    expect(queryClient.cancelQueries).toHaveBeenCalled()
    expect(queryClient.clear).toHaveBeenCalled()
    expect(clearModuleCaches).toHaveBeenCalled()
    expect(clearProviderState).toHaveBeenCalled()
    expect(window.localStorage.getItem('jji_user_data')).toBeNull()
  })

  it('cancels in-flight queries before clearing so a stale response cannot repopulate', async () => {
    const order: string[] = []
    const queryClient = {
      cancelQueries: vi.fn(() => void order.push('cancel')),
      clear: vi.fn(() => void order.push('clear')),
    }

    const coordinator = createAuthTransitionCacheCoordinator({ queryClient: queryClient as never })
    await runAuthTransition(coordinator, null)

    expect(order).toEqual(['cancel', 'clear'])
  })
})
