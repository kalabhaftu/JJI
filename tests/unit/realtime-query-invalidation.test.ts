import { describe, expect, it, vi } from 'vitest'

import { queryKeyPrefixes } from '@/lib/query/query-keys'
import type { QueryScope } from '@/lib/query/query-scope'
import {
  invalidateQueriesForRealtimeChange,
  resolveInvalidationKeys,
} from '@/lib/realtime/invalidation'
import type { DatabaseChange, RealtimeTable } from '@/lib/realtime/types'

const scope: QueryScope = { surface: 'authenticated', userId: 'user-1' }

function change(table: RealtimeTable, userId = 'user-1'): DatabaseChange {
  return {
    table,
    event: 'UPDATE',
    newRecord: { id: 'record-1' },
    oldRecord: null,
    timestamp: new Date(0),
    session: { userId, generation: 1 },
  }
}

describe('realtime query invalidation', () => {
  it('maps a table to only the domains it feeds', () => {
    expect(resolveInvalidationKeys(change('Notification'), scope)).toEqual([
      queryKeyPrefixes.notifications(scope),
    ])

    expect(resolveInvalidationKeys(change('Payout'), scope)).toEqual([
      queryKeyPrefixes.payouts(scope),
      queryKeyPrefixes.propFirmAccounts(scope),
    ])
  })

  it('never invalidates unrelated domains', () => {
    const keys = resolveInvalidationKeys(change('Notification'), scope)
    const flattened = JSON.stringify(keys)

    expect(flattened).not.toContain('settings')
    expect(flattened).not.toContain('reports')
    expect(flattened).not.toContain('goals')
  })

  it('ignores changes belonging to another user', () => {
    expect(resolveInvalidationKeys(change('Trade', 'user-2'), scope)).toEqual([])
  })

  it('keeps demo and authenticated scopes separate', () => {
    const demoScope: QueryScope = { surface: 'demo' }

    expect(resolveInvalidationKeys(change('Trade'), scope)).not.toEqual(
      resolveInvalidationKeys(change('Trade'), demoScope),
    )
  })

  it('invalidates each mapped key exactly once', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    const queryClient = { invalidateQueries } as never

    await invalidateQueriesForRealtimeChange(queryClient, change('Trade'), scope)

    expect(invalidateQueries).toHaveBeenCalledTimes(3)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.trades(scope) })
  })

  it('performs no work for a change with no mapped domain', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    const queryClient = { invalidateQueries } as never

    await invalidateQueriesForRealtimeChange(queryClient, change('Trade', 'other-user'), scope)

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
