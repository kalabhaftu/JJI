import { beforeEach, describe, expect, it } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

import { useTradovateSyncStore } from '@/store/tradovate-sync-store'

describe('Tradovate sync store', () => {
  const memory = new Map<string, string>()
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
  }

  beforeEach(() => {
    memory.clear()
    useTradovateSyncStore.persist.setOptions({ storage: createJSONStorage(() => storage) })
    useTradovateSyncStore.getState().clearAll()
  })

  it('keeps only non-sensitive server session metadata', () => {
    useTradovateSyncStore.getState().setAuthenticated(true)
    useTradovateSyncStore.getState().setSessionState({ accounts: [] })
    const state = useTradovateSyncStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state).not.toHaveProperty('accessToken')
    expect(state).not.toHaveProperty('refreshToken')
  })

  it('clears provider state without changing unrelated browser storage', () => {
    storage.setItem('unrelated-key', 'keep')
    useTradovateSyncStore.getState().setAuthenticated(true)
    useTradovateSyncStore.getState().clearAll()
    expect(useTradovateSyncStore.getState().isAuthenticated).toBe(false)
    expect(storage.getItem('unrelated-key')).toBe('keep')
  })

  it('updates session metadata via setSessionState', () => {
    const expiresAt = '2099-01-01T00:00:00.000Z'
    const accounts = [
      {
        id: 1,
        name: 'Test',
        nickname: 't',
        accountType: 'futures',
        active: true,
        clearingHouse: 'AMP',
        riskCategoryId: 1,
        autoLiqProfileId: 1,
        marginCalculationType: 'standard',
        legalStatus: 'Non-Pro',
      },
    ]
    useTradovateSyncStore.getState().setSessionState({ expiresAt, accounts })
    const state = useTradovateSyncStore.getState()
    expect(state.expiresAt).toBe(expiresAt)
    expect(state.accounts).toEqual(accounts)
  })

  it('reports not expired while expiresAt is in the future', () => {
    useTradovateSyncStore.getState().setSessionState({ expiresAt: '2099-01-01T00:00:00.000Z' })
    expect(useTradovateSyncStore.getState().isSessionExpired()).toBe(false)
  })

  it('reports expired when expiresAt is missing or in the past', () => {
    useTradovateSyncStore.getState().clearAll()
    expect(useTradovateSyncStore.getState().isSessionExpired()).toBe(true)
    useTradovateSyncStore.getState().setSessionState({ expiresAt: '2000-01-01T00:00:00.000Z' })
    expect(useTradovateSyncStore.getState().isSessionExpired()).toBe(true)
  })

  it('does not expose obsolete split setters', () => {
    const state = useTradovateSyncStore.getState() as unknown as Record<string, unknown>
    expect(state).not.toHaveProperty('setAccounts')
    expect(state).not.toHaveProperty('setOAuthState')
    expect(state).not.toHaveProperty('clearOAuthState')
    expect(state).not.toHaveProperty('updateLastSync')
    expect(state).not.toHaveProperty('setEnvironment')
    expect(state).not.toHaveProperty('getApiBaseUrl')
  })
})
