import { describe, expect, it } from 'vitest'
import { normalizeDatabaseChange } from '@/lib/realtime/database-realtime'

describe('realtime event normalization', () => {
  it('normalizes Supabase event names into the typed event field', () => {
    const change = normalizeDatabaseChange('Account', {
      eventType: 'UPDATE',
      new: { id: 'account-1' },
      old: { id: 'account-1' },
    }, { userId: 'user-1', generation: 1 })

    expect(change).toMatchObject({
      table: 'Account',
      event: 'UPDATE',
      session: { userId: 'user-1', generation: 1 },
    })
  })
})
