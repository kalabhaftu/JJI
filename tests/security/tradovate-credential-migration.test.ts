import { beforeEach, describe, expect, it } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

import { useTradovateSyncStore } from '@/store/tradovate-sync-store'

describe('Tradovate persisted-state migration', () => {
  const records = new Map<string, string>()
  const storage = {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { records.set(key, value) },
    removeItem: (key: string) => { records.delete(key) },
  }

  beforeEach(() => {
    records.clear()
    useTradovateSyncStore.persist.setOptions({ storage: createJSONStorage(() => storage) })
    useTradovateSyncStore.setState({ isAuthenticated: false, environment: 'demo' })
  })

  it('strips legacy credentials during actual Zustand rehydration and rewrites storage', async () => {
    records.set('tradovate-sync-storage', JSON.stringify({
      state: {
        isAuthenticated: true,
        accessToken: 'legacy-access',
        refreshToken: 'legacy-refresh',
        expiresAt: '2030-01-01T00:00:00.000Z',
        environment: 'live',
      },
      version: 0,
    }))

    await useTradovateSyncStore.persist.rehydrate()

    const runtime = useTradovateSyncStore.getState() as Record<string, unknown>
    expect(runtime.isAuthenticated).toBe(false)
    expect(runtime).not.toHaveProperty('accessToken')
    expect(runtime).not.toHaveProperty('refreshToken')

    const persisted = records.get('tradovate-sync-storage')!
    expect(persisted).not.toContain('legacy-access')
    expect(persisted).not.toContain('legacy-refresh')
    expect(JSON.parse(persisted).version).toBe(1)
  })
})
