import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
const realtime = vi.hoisted(() => ({ options: null as any }))

vi.mock('@/lib/utils/fetch-with-error', () => ({
  fetchWithError: fetchMock,
  handleFetchError: (error: unknown) => error instanceof Error ? error.message : 'Request failed',
}))
vi.mock('@/lib/realtime/database-realtime', () => ({
  useDatabaseRealtime: (options: unknown) => { realtime.options = options },
}))
vi.mock('@/store/user-store', () => ({ useUserStore: () => ({ id: 'user-1' }) }))
vi.mock('@/lib/public-surface-routing', () => ({ isDemoSurface: () => false }))
vi.mock('@/lib/observability/report-error', () => ({ reportClientError: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { usePropFirmRealtime } from '@/hooks/use-prop-firm-realtime'

type Snapshot = ReturnType<typeof usePropFirmRealtime>

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(next => { resolve = next })
  return { promise, resolve }
}

function response(id: string) {
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

function Probe({ accountId, snapshot }: { accountId: string; snapshot: (value: Snapshot) => void }) {
  snapshot(usePropFirmRealtime({ accountId }))
  return null
}

afterEach(() => {
  vi.clearAllMocks()
  realtime.options = null
})

describe('account stale-response guards', () => {
  it('aborts the old request on route change and ignores its late response', async () => {
    const oldRequest = deferred<ReturnType<typeof response>>()
    const newRequest = deferred<ReturnType<typeof response>>()
    fetchMock.mockImplementationOnce((_url: string, options: RequestInit) => {
      expect(options.signal).toBeInstanceOf(AbortSignal)
      return oldRequest.promise
    }).mockImplementationOnce(() => newRequest.promise)
    let current!: Snapshot
    const root = createRoot(document.createElement('div'))

    await act(async () => root.render(createElement(Probe, { accountId: 'old', snapshot: value => { current = value } })))
    await act(async () => root.render(createElement(Probe, { accountId: 'new', snapshot: value => { current = value } })))
    expect(fetchMock.mock.calls[0]?.[1].signal.aborted).toBe(true)

    await act(async () => newRequest.resolve(response('new')))
    await act(async () => oldRequest.resolve(response('old')))
    expect(current.account?.id).toBe('new')

    await act(async () => root.unmount())
  })

  it('preserves prior account data when a transient refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(response('account-1')).mockResolvedValueOnce({
      ok: false,
      data: null,
      error: { message: 'Service unavailable', status: 503 },
      status: 503,
    })
    let current!: Snapshot
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, { accountId: 'account-1', snapshot: value => { current = value } })))
    expect(current.account?.id).toBe('account-1')

    await act(async () => { await current.refetch() })
    expect(current.account?.id).toBe('account-1')
    expect(current.error).toBe('Service unavailable')

    await act(async () => root.unmount())
  })

  it('clears account data and request state when changing from account A to account B', async () => {
    const accountA = deferred<ReturnType<typeof response>>()
    const accountB = deferred<ReturnType<typeof response>>()
    fetchMock.mockImplementationOnce(() => accountA.promise).mockImplementationOnce(() => accountB.promise)
    let current!: Snapshot
    const root = createRoot(document.createElement('div'))

    await act(async () => root.render(createElement(Probe, { accountId: 'account-a', snapshot: value => { current = value } })))
    await act(async () => root.render(createElement(Probe, { accountId: 'account-b', snapshot: value => { current = value } })))

    expect(fetchMock.mock.calls[0]?.[1].signal.aborted).toBe(true)
    expect(current.account).toBeNull()
    expect(current.drawdown).toBeNull()
    expect(current.isLoading).toBe(true)

    await act(async () => accountB.resolve(response('account-b')))
    await act(async () => accountA.resolve(response('account-a')))
    expect(current.account?.id).toBe('account-b')

    await act(async () => root.unmount())
  })

  it('does not let a stale trade refresh from account A update account B', async () => {
    const accountA = deferred<ReturnType<typeof response>>()
    const accountB = deferred<ReturnType<typeof response>>()
    fetchMock.mockImplementationOnce(() => accountA.promise)
    let current!: Snapshot
    const root = createRoot(document.createElement('div'))

    await act(async () => root.render(createElement(Probe, { accountId: 'account-a', snapshot: value => { current = value } })))
    await act(async () => accountA.resolve(response('account-a')))
    expect(current.account?.id).toBe('account-a')

    const tradeRefresh = deferred<ReturnType<typeof response>>()
    fetchMock.mockImplementationOnce(() => tradeRefresh.promise)
    await act(async () => { await realtime.options.onTradeChange({ newRecord: { phaseAccountId: 'account-a-phase' } }) })

    fetchMock.mockImplementationOnce(() => accountB.promise)
    await act(async () => root.render(createElement(Probe, { accountId: 'account-b', snapshot: value => { current = value } })))
    await act(async () => accountB.resolve(response('account-b')))
    await act(async () => tradeRefresh.resolve(response('account-a')))

    expect(current.account?.id).toBe('account-b')
    await act(async () => root.unmount())
  })
})
