import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const useQueryMock = vi.hoisted(() => vi.fn())
const apiRequestDataMock = vi.hoisted(() => vi.fn())
const useQueryScopeMock = vi.hoisted(() => vi.fn(() => ({ surface: 'authenticated', userId: 'user-1' })))
const isScopeReadyMock = vi.hoisted(() => vi.fn(() => true))
const realtime = vi.hoisted(() => ({ options: null as any }))
const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))

vi.mock('@tanstack/react-query', () => ({ useQuery: useQueryMock }))
vi.mock('@/lib/api/client', () => ({ apiRequestData: apiRequestDataMock }))
vi.mock('@/lib/query/use-query-scope', () => ({
  useQueryScope: useQueryScopeMock,
  isScopeReady: isScopeReadyMock,
}))
vi.mock('@/lib/realtime/database-realtime', () => ({
  useDatabaseRealtime: (options: unknown) => { realtime.options = options },
}))
vi.mock('@/store/user-store', () => ({ useUserStore: () => ({ id: 'user-1' }) }))
vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('@/lib/observability/report-error', () => ({ reportClientError: vi.fn() }))

import { queryKeys } from '@/lib/query/query-keys'
import { usePropFirmRealtime } from '@/hooks/use-prop-firm-realtime'

type Snapshot = ReturnType<typeof usePropFirmRealtime>

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
  key: string
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
  records.push({ options, key, state })
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(next => { resolve = next })
  return { promise, resolve }
}

function accountData(id: string, status = 'active') {
  return {
    account: { id, accountName: id, status, phases: [{ id: `${id}-phase` }], lastUpdated: new Date().toISOString() },
    drawdown: { isBreached: false },
  }
}

function Probe({ accountId, enabled, snapshot }: { accountId?: string; enabled?: boolean; snapshot: (value: Snapshot) => void }) {
  snapshot(usePropFirmRealtime({ accountId, enabled }))
  return null
}

afterEach(() => {
  vi.clearAllMocks()
  states.clear()
  records.length = 0
  useQueryScopeMock.mockReturnValue({ surface: 'authenticated', userId: 'user-1' })
  isScopeReadyMock.mockReturnValue(true)
  realtime.options = null
})

describe('account stale-response guards', () => {
  it('queries the canonical prop-firm account key with a signal and operation', async () => {
    apiRequestDataMock.mockResolvedValue(accountData('account-1'))
    let current!: Snapshot
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, { accountId: 'account-1', snapshot: value => { current = value } })))

    const record = records.at(-1)!
    expect(record.options.queryKey).toEqual(queryKeys.propFirmAccount({ surface: 'authenticated', userId: 'user-1' }, 'account-1'))
    expect(record.options.enabled).toBe(true)
    expect(record.options.staleTime).toBe(30_000)

    const signal = new AbortController().signal
    await act(async () => { await record.options.queryFn({ signal }) })
    expect(apiRequestDataMock).toHaveBeenCalledWith('/api/v1/prop-firm/accounts/account-1', {
      signal,
      operation: 'load-prop-firm-account',
    })
    expect(current.isLoading).toBe(true)

    await act(async () => root.unmount())
  })

  it('gates the query on accountId, the enabled option, and scope readiness', async () => {
    let current!: Snapshot
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, { snapshot: value => { current = value } })))
    expect(records.at(-1)!.options.enabled).toBe(false)

    await act(async () => root.render(createElement(Probe, { accountId: 'account-1', enabled: false, snapshot: value => { current = value } })))
    expect(records.at(-1)!.options.enabled).toBe(false)

    isScopeReadyMock.mockReturnValue(false)
    await act(async () => root.render(createElement(Probe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(records.at(-1)!.options.enabled).toBe(false)

    useQueryScopeMock.mockReturnValue({ surface: 'demo' })
    isScopeReadyMock.mockReturnValue(true)
    await act(async () => root.render(createElement(Probe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(records.at(-1)!.options.enabled).toBe(true)

    await act(async () => root.unmount())
  })

  it('preserves prior account data when a transient refresh fails', async () => {
    apiRequestDataMock.mockResolvedValue(accountData('account-1'))
    let current!: Snapshot
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, { accountId: 'account-1', snapshot: value => { current = value } })))
    await act(async () => { await current.refetch() })
    await act(async () => root.render(createElement(Probe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(current.account?.id).toBe('account-1')
    expect(current.lastUpdated).toBeInstanceOf(Date)

    apiRequestDataMock.mockRejectedValue(new Error('Service unavailable'))
    await act(async () => { await current.refetch() })
    await act(async () => root.render(createElement(Probe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(current.account?.id).toBe('account-1')
    expect(current.error).toBe('Service unavailable')

    await act(async () => root.unmount())
  })

  it('isolates stale responses by switching the query key when the account changes', async () => {
    const accountAResponse = deferred<ReturnType<typeof accountData>>()
    apiRequestDataMock.mockImplementationOnce(() => accountAResponse.promise)
    let current!: Snapshot
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, { accountId: 'account-a', snapshot: value => { current = value } })))
    const staleQueryFn = records.at(-1)!.options.queryFn
    const staleSignal = new AbortController().signal

    await act(async () => root.render(createElement(Probe, { accountId: 'account-b', snapshot: value => { current = value } })))
    expect(records.at(-1)!.options.queryKey).not.toEqual(records[0].options.queryKey)

    const stalePromise = staleQueryFn({ signal: staleSignal })
    await act(async () => accountAResponse.resolve(accountData('account-a')))
    await act(async () => { await stalePromise })
    await act(async () => root.render(createElement(Probe, { accountId: 'account-b', snapshot: value => { current = value } })))
    expect(current.account).toBeNull()
    expect(current.drawdown).toBeNull()
    expect(current.isLoading).toBe(true)

    await act(async () => root.unmount())
  })
})
