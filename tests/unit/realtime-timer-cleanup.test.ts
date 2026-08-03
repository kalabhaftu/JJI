import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const realtime = vi.hoisted(() => ({ options: null as null | { onTradeChange?: () => void } }))
const clearTrades = vi.hoisted(() => vi.fn())

vi.mock('@/lib/realtime/database-realtime', () => ({
  useDatabaseRealtime: (options: typeof realtime.options) => { realtime.options = options },
}))
vi.mock('@/hooks/use-accounts', () => ({ clearTradesCache: clearTrades, clearAccountsCache: vi.fn() }))

import { useDataProviderRealtime } from '@/hooks/use-data-provider-realtime'

function Probe() {
  useDataProviderRealtime({
    userId: 'user-1',
    enabled: true,
    queryClient: { invalidateQueries: vi.fn() } as never,
    reloadBootstrapData: vi.fn(),
  })
  return null
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  realtime.options = null
})

describe('realtime timer cleanup', () => {
  it('clears the current scheduled timer on unmount', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe)))
    act(() => realtime.options?.onTradeChange?.())

    await act(async () => root.unmount())
    await act(async () => vi.runAllTimersAsync())

    expect(clearTrades).not.toHaveBeenCalled()
  })
})
