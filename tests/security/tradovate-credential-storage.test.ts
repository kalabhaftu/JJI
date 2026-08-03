import { describe, expect, it, vi } from 'vitest'

import { persistedTradovateState, clearTradovateLegacyStorage } from '@/store/tradovate-sync-store'

describe('Tradovate browser credential storage', () => {
  it('persists session metadata without access or refresh tokens', () => {
    const persisted = persistedTradovateState({
      isAuthenticated: true,
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      expiresAt: '2030-01-01T00:00:00.000Z',
      accounts: [],
      lastSync: '2030-01-01T00:00:00.000Z',
      environment: 'demo',
      oauthState: 'state',
    })

    expect(persisted).not.toHaveProperty('accessToken')
    expect(persisted).not.toHaveProperty('refreshToken')
    expect(JSON.stringify(persisted)).not.toContain('secret')
  })

  it('removes only Tradovate legacy keys', () => {
    const removeItem = vi.fn()
    clearTradovateLegacyStorage({ removeItem } as unknown as Storage)
    expect(removeItem).toHaveBeenCalledWith('tradovate_access_token')
    expect(removeItem).toHaveBeenCalledWith('tradovate_token_expiration')
    expect(removeItem).toHaveBeenCalledWith('tradovate_environment')
    expect(removeItem).not.toHaveBeenCalledWith('unrelated-key')
  })
})
