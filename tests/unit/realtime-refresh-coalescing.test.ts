import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseChange } from '@/lib/realtime/types'

const realtime = vi.hoisted(() => ({ options: null as null | {
  onTradeChange?: (change: DatabaseChange) => void
  onAccountChange?: (change: DatabaseChange) => void
} }))

const cache = vi.hoisted(() => ({ clearTrades: vi.fn(), clearAccounts: vi.fn() }))
const fetchMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/realtime/database-realtime', () => ({
  useDatabaseRealtime: (options: typeof realtime.options) => { realtime.options = options },
}))
vi.mock('@/hooks/use-accounts', () => ({
  clearTradesCache: cache.clearTrades,
  clearAccountsCache: cache.clearAccounts,
}))
vi.mock('@/lib/utils/fetch-with-error', () => ({
  fetchWithError: fetchMock,
  handleFetchError: (error: unknown) => error instanceof Error ? error.message : 'Request failed',
}))
vi.mock('@/store/user-store', () => ({ useUserStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'user-1' } }) }))
vi.mock('@/lib/public-surface-routing', () => ({ isDemoSurface: () => false }))
vi.mock('@/lib/observability/report-error', () => ({ reportClientError: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { useDataProviderRealtime } from '@/hooks/use-data-provider-realtime'
import { usePropFirmRealtime } from '@/hooks/use-prop-firm-realtime'

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
    scope: { surface: 'authenticated', userId: 'user-1' },
    reloadBootstrapData: vi.fn(),
  })
  return null
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(next => { resolve = next })
  return { promise, resolve }
}

function accountResponse(id: string) {
  return {
    ok: true,
    data: {
      success: true,
      data: {
        account: { id, accountName: id, status: 'active', phases: [{ id: `${id}-phase` }], lastUpdated: new Date().toISOString() },
        drawdown: { isBreached: false },
      },
    },
    error: null,
    status: 200,
  }
}

function PropFirmProbe() {
  usePropFirmRealtime({ accountId: 'account-1' })
  return null
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  fetchMock.mockReset()
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

  it('keeps one prop firm refresh active and coalesces a burst into one follow-up', async () => {
    const activeRefresh = deferred<ReturnType<typeof accountResponse>>()
    const followUpRefresh = deferred<ReturnType<typeof accountResponse>>()
    fetchMock
      .mockResolvedValueOnce(accountResponse('account-1'))
      .mockImplementationOnce(() => activeRefresh.promise)
      .mockImplementationOnce(() => followUpRefresh.promise)
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(PropFirmProbe)))

    act(() => realtime.options?.onAccountChange?.({
      ...change,
      table: 'MasterAccount',
      newRecord: { id: 'account-1' },
    }))
    const activeSignal = fetchMock.mock.calls[1]?.[1].signal as AbortSignal

    act(() => {
      realtime.options?.onAccountChange?.({ ...change, table: 'MasterAccount', newRecord: { id: 'account-1' } })
      realtime.options?.onAccountChange?.({ ...change, table: 'MasterAccount', newRecord: { id: 'account-1' } })
      realtime.options?.onAccountChange?.({ ...change, table: 'MasterAccount', newRecord: { id: 'account-1' } })
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(activeSignal.aborted).toBe(false)

    await act(async () => activeRefresh.resolve(accountResponse('account-1')))
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await act(async () => followUpRefresh.resolve(accountResponse('account-1')))
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await act(async () => root.unmount())
  })
})
