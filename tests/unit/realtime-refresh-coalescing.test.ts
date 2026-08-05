import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseChange } from '@/lib/realtime/types'

const realtime = vi.hoisted(() => ({ options: null as null | {
  onTradeChange?: (change: DatabaseChange) => void
  onAccountChange?: (change: DatabaseChange) => void
  onStatusChange?: (status: string) => void
} }))

const fetchMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
const useQueryMock = vi.hoisted(() => vi.fn())
const apiRequestDataMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/realtime/database-realtime', () => ({
  useDatabaseRealtime: (options: typeof realtime.options) => { realtime.options = options },
}))
vi.mock('@/lib/utils/fetch-with-error', () => ({
  fetchWithError: fetchMock,
  handleFetchError: (error: unknown) => error instanceof Error ? error.message : 'Request failed',
}))
vi.mock('@/store/user-store', () => ({ useUserStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'user-1' } }) }))
vi.mock('@/lib/observability/report-error', () => ({ reportClientError: vi.fn() }))
vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('@tanstack/react-query', () => ({ useQuery: useQueryMock }))
vi.mock('@/lib/api/client', () => ({ apiRequestData: apiRequestDataMock }))
vi.mock('@/lib/query/use-query-scope', () => ({
  useQueryScope: () => ({ surface: 'authenticated', userId: 'user-1' }),
  isScopeReady: () => true,
}))

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

interface QueryState {
  data: unknown
  error: Error | null
  isLoading: boolean
  dataUpdatedAt: number
}

interface QueryRecord {
  options: {
    queryKey: readonly unknown[]
    queryFn: (context: { signal: AbortSignal }) => Promise<unknown>
    enabled?: boolean
    staleTime?: number
  }
  state: QueryState
}

const states = new Map<string, QueryState>()
const records: QueryRecord[] = []

useQueryMock.mockImplementation((options: QueryRecord['options']) => {
  const key = JSON.stringify(options.queryKey)
  let state = states.get(key)
  if (!state) {
    state = { data: undefined, error: null, isLoading: true, dataUpdatedAt: 0 }
    states.set(key, state)
  }
  records.push({ options, state })
  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    dataUpdatedAt: state.dataUpdatedAt,
    refetch: async () => {
      state.isLoading = true
      try {
        const result = await options.queryFn({ signal: new AbortController().signal })
        state.data = result
        state.error = null
        state.dataUpdatedAt = Date.now()
      } catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error))
      } finally {
        state.isLoading = false
      }
    },
  }
})

function accountData(id: string, status = 'active', isBreached = false) {
  return {
    account: { id, accountName: id, status, phases: [{ id: `${id}-phase` }], lastUpdated: new Date().toISOString() },
    drawdown: { isBreached, breachType: 'max_drawdown' },
  }
}

type PropFirmSnapshot = ReturnType<typeof usePropFirmRealtime>

function PropFirmProbe({
  accountId,
  enabled = true,
  snapshot,
}: {
  accountId?: string
  enabled?: boolean
  snapshot?: (value: PropFirmSnapshot) => void
}) {
  const value = usePropFirmRealtime({ accountId, enabled })
  snapshot?.(value)
  return null
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  fetchMock.mockReset()
  states.clear()
  records.length = 0
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
    expect(invalidate).toHaveBeenCalledTimes(3)

    act(() => {
      realtime.options?.onTradeChange?.(change)
      realtime.options?.onTradeChange?.(change)
    })
    await act(async () => vi.advanceTimersByTimeAsync(500))
    expect(invalidate).toHaveBeenCalledTimes(6)

    await act(async () => root.unmount())
  })

  it('invalidates the union of heterogeneous account changes in one burst', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const invalidate = vi.fn()
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, { invalidate })))

    act(() => {
      realtime.options?.onAccountChange?.({ ...change, table: 'Account' })
      realtime.options?.onAccountChange?.({ ...change, table: 'Payout' })
    })
    await act(async () => vi.advanceTimersByTimeAsync(250))

    const keys = invalidate.mock.calls.map(([options]) => options.queryKey)
    expect(keys).toEqual(expect.arrayContaining([
      ['accounts', { surface: 'authenticated', userId: 'user-1' }],
      ['prop-firm', 'payouts', { surface: 'authenticated', userId: 'user-1' }],
      ['prop-firm', 'accounts', { surface: 'authenticated', userId: 'user-1' }],
    ]))
    expect(invalidate).toHaveBeenCalledTimes(3)
    await act(async () => root.unmount())
  })

  it('keeps only the status-change realtime subscription for prop-firm accounts', async () => {
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1' })))

    expect(typeof realtime.options?.onStatusChange).toBe('function')
    expect(realtime.options?.onAccountChange).toBeUndefined()
    expect(realtime.options?.onTradeChange).toBeUndefined()

    await act(async () => root.unmount())
  })

  it('updates isConnected from the realtime status', async () => {
    let current!: PropFirmSnapshot
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(current.isConnected).toBe(false)

    await act(async () => { realtime.options?.onStatusChange?.('connected') })
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(current.isConnected).toBe(true)

    await act(async () => { realtime.options?.onStatusChange?.('disconnected') })
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(current.isConnected).toBe(false)

    await act(async () => root.unmount())
  })

  it('fires a status-change toast once per transition', async () => {
    apiRequestDataMock
      .mockResolvedValueOnce(accountData('account-1', 'active'))
      .mockResolvedValueOnce(accountData('account-1', 'funded'))
      .mockResolvedValueOnce(accountData('account-1', 'failed'))
    let current!: PropFirmSnapshot
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    await act(async () => { await current.refetch() })

    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(toastMock.success).not.toHaveBeenCalled()

    await act(async () => { await current.refetch() })
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(toastMock.success).toHaveBeenCalledTimes(1)
    expect(toastMock.success).toHaveBeenCalledWith('Account Funded!', expect.anything())

    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(toastMock.success).toHaveBeenCalledTimes(1)

    await act(async () => { await current.refetch() })
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(toastMock.error).toHaveBeenCalledTimes(1)
    expect(toastMock.error).toHaveBeenCalledWith('Account Failed', expect.anything())

    await act(async () => root.unmount())
  })

  it('does not toast on the initial load or after switching accounts', async () => {
    apiRequestDataMock
      .mockResolvedValueOnce(accountData('account-1', 'funded'))
      .mockResolvedValueOnce(accountData('account-2', 'funded'))
    let current!: PropFirmSnapshot
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    await act(async () => { await current.refetch() })
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(toastMock.success).not.toHaveBeenCalled()

    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-2', snapshot: value => { current = value } })))
    await act(async () => { await current.refetch() })
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-2', snapshot: value => { current = value } })))
    expect(current.account?.id).toBe('account-2')
    expect(toastMock.success).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('fires a breach toast only when the breach state transitions', async () => {
    apiRequestDataMock
      .mockResolvedValueOnce(accountData('account-1', 'active', false))
      .mockResolvedValueOnce(accountData('account-1', 'active', true))
    let current!: PropFirmSnapshot
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    await act(async () => { await current.refetch() })
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(toastMock.error).not.toHaveBeenCalled()

    await act(async () => { await current.refetch() })
    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(toastMock.error).toHaveBeenCalledTimes(1)
    expect(toastMock.error).toHaveBeenCalledWith('Drawdown Breach Alert!', expect.anything())

    await act(async () => root.render(createElement(PropFirmProbe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(toastMock.error).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
  })
})
