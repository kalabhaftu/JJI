import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseChange } from '@/lib/realtime/types'

const realtime = vi.hoisted(() => ({ options: null as null | {
  onTradeChange?: (change: DatabaseChange) => void
  onAccountChange?: (change: DatabaseChange) => void
} }))

const cache = vi.hoisted(() => ({ clearTrades: vi.fn(), clearAccounts: vi.fn() }))

vi.mock('@/lib/realtime/database-realtime', () => ({
  useDatabaseRealtime: (options: typeof realtime.options) => { realtime.options = options },
}))
vi.mock('@/hooks/use-accounts', () => ({
  clearTradesCache: cache.clearTrades,
  clearAccountsCache: cache.clearAccounts,
}))

import { useDataProviderRealtime } from '@/hooks/use-data-provider-realtime'

const change: DatabaseChange = {
  table: 'Trade',
  event: 'UPDATE',
  newRecord: { id: 'trade-1' },
  oldRecord: { id: 'trade-1' },
  timestamp: new Date(),
  session: { userId: 'user-1', generation: 1 },
}

function Probe({ invalidate }: { invalidate: ReturnType<typeof vi.fn> }) {
  useDataProviderRealtime({
    userId: 'user-1',
    enabled: true,
    queryClient: { invalidateQueries: invalidate } as never,
    reloadBootstrapData: vi.fn(),
  })
  return null
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  realtime.options = null
})

describe('realtime refresh coalescing', () => {
  it('runs one refresh and one follow-up when events arrive during a burst', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const invalidate = vi.fn()
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, { invalidate })))

    act(() => {
      realtime.options?.onTradeChange?.(change)
      realtime.options?.onTradeChange?.(change)
      realtime.options?.onTradeChange?.(change)
    })
    await act(async () => vi.advanceTimersByTimeAsync(250))
    expect(cache.clearTrades).toHaveBeenCalledTimes(1)

    act(() => {
      realtime.options?.onTradeChange?.(change)
      realtime.options?.onTradeChange?.(change)
    })
    await act(async () => vi.advanceTimersByTimeAsync(500))
    expect(cache.clearTrades).toHaveBeenCalledTimes(2)

    await act(async () => root.unmount())
  })
})
