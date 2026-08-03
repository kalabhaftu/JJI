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
    useTradovateSyncStore.getState().setAccounts([])
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
})
