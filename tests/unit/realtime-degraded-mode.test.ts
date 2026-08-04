import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import type { FreshnessState, RealtimeStatus } from '@/lib/realtime/types'
import type { QueryScope } from '@/lib/query/query-scope'

const realtime = vi.hoisted(() => ({
  options: null as null | { onStatusChange?: (status: RealtimeStatus) => void },
  recoverOnce: vi.fn(),
}))

vi.mock('@/lib/realtime/database-realtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/realtime/database-realtime')>()
  return {
    ...original,
    useDatabaseRealtime: (options: typeof realtime.options) => { realtime.options = options },
    recoverDatabaseRealtimeOnce: realtime.recoverOnce,
  }
})
vi.mock('@/hooks/use-accounts', () => ({ clearTradesCache: vi.fn(), clearAccountsCache: vi.fn() }))
vi.mock('@/lib/logger', () => ({ default: { warn: vi.fn(), debug: vi.fn() } }))

import { DatabaseRealtimeManager } from '@/lib/realtime/database-realtime'
import { useDataProviderRealtime } from '@/hooks/use-data-provider-realtime'

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
}

function setVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: visibilityState })
  document.dispatchEvent(new Event('visibilitychange'))
}

function Probe({
  enabled = true,
  invalidateQueries,
  queryClient,
  snapshot,
  scope = { surface: 'authenticated', userId: 'user-1' },
  userId = 'user-1',
}: {
  enabled?: boolean
  invalidateQueries?: ReturnType<typeof vi.fn>
  queryClient?: QueryClient
  snapshot: (freshness: FreshnessState) => void
  scope?: QueryScope
  userId?: string
}) {
  const query = {
    queryHash: 'mock-query',
    queryKey: ['trades', { surface: 'authenticated', userId: 'user-1' }],
    state: { dataUpdatedAt: 0 },
  }
  const mockQueryClient = {
    invalidateQueries: async (...args: unknown[]) => {
      const result = await invalidateQueries?.(...args)
      query.state.dataUpdatedAt++
      return result
    },
    getQueryCache: () => ({ findAll: () => [query] }),
  }
  const freshness = useDataProviderRealtime({
    userId,
    enabled,
    queryClient: queryClient ?? mockQueryClient as never,
    scope,
    reloadBootstrapData: vi.fn(),
  })
  snapshot(freshness)
  return null
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  realtime.recoverOnce.mockReset()
  realtime.options = null
  setOnline(true)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

describe('degraded realtime mode', () => {
  it('emits degraded only after reconnect exhaustion and returns to connected', async () => {
    vi.useFakeTimers()
    let subscription = 0
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback(subscription++ < 6 ? 'CHANNEL_ERROR' : 'SUBSCRIBED')
      }),
      unsubscribe: vi.fn(),
    }
    const manager = new DatabaseRealtimeManager(() => ({ channel: vi.fn(() => channel) }) as never)
    const onStatusChange = vi.fn()

    const unsubscribe = manager.subscribe({ tables: ['Trade'], userId: 'user-1', onChange: vi.fn(), onStatusChange })
    await vi.runAllTimersAsync()

    expect(onStatusChange).toHaveBeenCalledWith('degraded')
    manager.recoverOnce()
    await Promise.resolve()
    expect(onStatusChange).toHaveBeenLastCalledWith('connected')
    unsubscribe()
  })

  it('refreshes active scoped queries conservatively and preserves cached data', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'))
    const invalidateQueries = vi.fn()
    let freshness!: FreshnessState
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      invalidateQueries,
      snapshot: (value) => { freshness = value },
    })))

    act(() => realtime.options?.onStatusChange?.('degraded'))
    expect(freshness.status).toBe('degraded')
    expect(freshness.source).toBe('polling')
    expect(freshness.staleSince).toEqual(new Date('2026-08-03T12:00:00Z'))

    await act(async () => vi.advanceTimersByTimeAsync(60_000))
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    const filter = invalidateQueries.mock.calls[0][0]
    expect(filter.type).toBe('active')
    expect(filter.predicate({ queryKey: ['trades', { surface: 'authenticated', userId: 'user-1' }, 'filters'] })).toBe(true)
    expect(filter.predicate({ queryKey: ['reports', 'stats', { surface: 'authenticated', userId: 'user-1' }, 'filters'] })).toBe(true)
    expect(filter.predicate({ queryKey: ['prop-firm', 'accounts', { surface: 'authenticated', userId: 'user-1' }] })).toBe(true)
    expect(filter.predicate({ queryKey: ['trades', { surface: 'authenticated', userId: 'other-user' }] })).toBe(false)
    expect(filter.predicate({ queryKey: ['trades', { surface: 'demo' }] })).toBe(false)
    expect(filter.predicate({ queryKey: ['public-data', { surface: 'authenticated', userId: 'user-1' }] })).toBe(false)
    expect(filter.predicate({ queryKey: ['public-data'] })).toBe(false)
    expect(freshness.updatedAt).toEqual(new Date('2026-08-03T12:01:00Z'))

    act(() => realtime.options?.onStatusChange?.('connected'))
    expect(freshness).toEqual({
      source: 'realtime',
      status: 'current',
      updatedAt: new Date('2026-08-03T12:01:00Z'),
      staleSince: null,
    })
    await act(async () => vi.advanceTimersByTimeAsync(120_000))
    expect(invalidateQueries).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
  })

  it('suppresses polling while hidden, offline, or disabled and refreshes once on restoration', async () => {
    vi.useFakeTimers()
    const invalidateQueries = vi.fn()
    let freshness!: FreshnessState
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      invalidateQueries,
      snapshot: (value) => { freshness = value },
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))

    act(() => setVisibility('hidden'))
    await act(async () => vi.advanceTimersByTimeAsync(120_000))
    expect(invalidateQueries).not.toHaveBeenCalled()

    act(() => setVisibility('visible'))
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(realtime.recoverOnce).toHaveBeenCalledTimes(1)

    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(freshness.status).toBe('offline')
    await act(async () => vi.advanceTimersByTimeAsync(120_000))
    expect(invalidateQueries).toHaveBeenCalledTimes(1)

    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(freshness.status).toBe('degraded')
    expect(invalidateQueries).toHaveBeenCalledTimes(2)
    expect(realtime.recoverOnce).toHaveBeenCalledTimes(1)

    await act(async () => root.render(createElement(Probe, {
      enabled: false,
      invalidateQueries,
      snapshot: (value) => { freshness = value },
    })))
    await act(async () => vi.advanceTimersByTimeAsync(120_000))
    expect(invalidateQueries).toHaveBeenCalledTimes(2)

    await act(async () => root.unmount())
  })

  it('automatically returns to current when restoration reconnect succeeds', async () => {
    vi.useFakeTimers()
    let freshness!: FreshnessState
    realtime.recoverOnce.mockImplementationOnce(() => realtime.options?.onStatusChange?.('connected'))
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      snapshot: (value) => { freshness = value },
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))
    act(() => setVisibility('hidden'))

    await act(async () => setVisibility('visible'))

    expect(realtime.recoverOnce).toHaveBeenCalledTimes(1)
    expect(freshness.status).toBe('current')
    expect(freshness.source).toBe('realtime')
    await act(async () => root.unmount())
  })

  it('attempts realtime reconnect only once per restoration cycle', async () => {
    vi.useFakeTimers()
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      snapshot: vi.fn(),
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))
    act(() => setVisibility('hidden'))

    act(() => {
      setVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('online'))
    })

    expect(realtime.recoverOnce).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
  })

  it('does not rearm restoration when one-shot recovery emits error and degraded', async () => {
    vi.useFakeTimers()
    realtime.recoverOnce.mockImplementation(() => {
      realtime.options?.onStatusChange?.('error')
      realtime.options?.onStatusChange?.('degraded')
    })
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      snapshot: vi.fn(),
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))
    act(() => setVisibility('hidden'))
    act(() => setVisibility('visible'))

    act(() => {
      window.dispatchEvent(new Event('online'))
      setVisibility('hidden')
      setVisibility('visible')
      window.dispatchEvent(new Event('online'))
    })

    expect(realtime.recoverOnce).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
  })

  it('reports transient disconnects as stale cache without blanking freshness', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'))
    let freshness!: FreshnessState
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      invalidateQueries: vi.fn(),
      snapshot: (value) => { freshness = value },
    })))

    act(() => realtime.options?.onStatusChange?.('connected'))
    vi.setSystemTime(new Date('2026-08-03T12:01:00Z'))
    act(() => realtime.options?.onStatusChange?.('error'))

    expect(freshness).toEqual({
      source: 'cache',
      status: 'stale',
      updatedAt: new Date('2026-08-03T12:00:00Z'),
      staleSince: new Date('2026-08-03T12:01:00Z'),
    })
    await act(async () => root.unmount())
  })

  it('retains degraded timestamps when polling rejects without an unhandled rejection', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'))
    const invalidateQueries = vi.fn().mockRejectedValue(new Error('refresh failed'))
    let freshness!: FreshnessState
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      invalidateQueries,
      snapshot: (value) => { freshness = value },
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))

    await act(async () => vi.advanceTimersByTimeAsync(60_000))

    expect(freshness.status).toBe('degraded')
    expect(freshness.updatedAt).toBeNull()
    expect(freshness.staleSince).toEqual(new Date('2026-08-03T12:00:00Z'))
    await act(async () => root.unmount())
  })

  it('does not advance freshness when a real active query refetch rejects', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const queryFn = vi.fn().mockRejectedValue(new Error('refetch failed'))
    queryClient.setQueryData(['trades', { surface: 'authenticated', userId: 'user-1' }, 'filters'], [])
    const observer = new QueryObserver(queryClient, {
      queryKey: ['trades', { surface: 'authenticated', userId: 'user-1' }, 'filters'],
      queryFn,
      staleTime: Infinity,
    })
    const unsubscribe = observer.subscribe(() => undefined)
    let freshness!: FreshnessState
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      queryClient,
      snapshot: (value) => { freshness = value },
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))

    await act(async () => vi.advanceTimersByTimeAsync(60_000))

    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(freshness.updatedAt).toBeNull()
    unsubscribe()
    await act(async () => root.unmount())
    queryClient.clear()
  })

  it('does not advance freshness when no active scoped query matches', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'))
    const queryClient = new QueryClient()
    let freshness!: FreshnessState
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      queryClient,
      snapshot: (value) => { freshness = value },
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))

    await act(async () => vi.advanceTimersByTimeAsync(60_000))

    expect(freshness.updatedAt).toBeNull()
    await act(async () => root.unmount())
    queryClient.clear()
  })

  it('advances freshness after a matching active query demonstrably refreshes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const queryKey = ['trades', { surface: 'authenticated', userId: 'user-1' }, 'filters'] as const
    queryClient.setQueryData(queryKey, ['cached'])
    const queryFn = vi.fn().mockResolvedValue(['fresh'])
    const observer = new QueryObserver(queryClient, { queryKey, queryFn, staleTime: Infinity })
    const unsubscribe = observer.subscribe(() => undefined)
    let freshness!: FreshnessState
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      queryClient,
      snapshot: (value) => { freshness = value },
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))

    await act(async () => vi.advanceTimersByTimeAsync(60_000))

    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(freshness.updatedAt).toEqual(new Date('2026-08-03T12:01:00Z'))
    unsubscribe()
    await act(async () => root.unmount())
    queryClient.clear()
  })

  it('does not advance freshness when a matching query becomes inactive during refetch', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const queryKey = ['trades', { surface: 'authenticated', userId: 'user-1' }, 'filters'] as const
    queryClient.setQueryData(queryKey, ['cached'])
    let unsubscribe = () => undefined
    const queryFn = vi.fn(async () => {
      unsubscribe()
      return ['fresh']
    })
    const observer = new QueryObserver(queryClient, { queryKey, queryFn, staleTime: Infinity })
    unsubscribe = observer.subscribe(() => undefined)
    let freshness!: FreshnessState
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      queryClient,
      snapshot: (value) => { freshness = value },
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))

    await act(async () => vi.advanceTimersByTimeAsync(60_000))

    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(freshness.updatedAt).toBeNull()
    await act(async () => root.unmount())
    queryClient.clear()
  })

  it('does not advance freshness when a static active query skips refetch', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const queryKey = ['trades', { surface: 'authenticated', userId: 'user-1' }, 'filters'] as const
    queryClient.setQueryData(queryKey, ['cached'])
    const queryFn = vi.fn().mockResolvedValue(['fresh'])
    const observer = new QueryObserver(queryClient, { queryKey, queryFn, staleTime: 'static' })
    const unsubscribe = observer.subscribe(() => undefined)
    let freshness!: FreshnessState
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      queryClient,
      snapshot: (value) => { freshness = value },
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))

    await act(async () => vi.advanceTimersByTimeAsync(60_000))

    expect(queryFn).not.toHaveBeenCalled()
    expect(freshness.updatedAt).toBeNull()
    unsubscribe()
    await act(async () => root.unmount())
    queryClient.clear()
  })

  it('ignores a degraded refresh that resolves after disable or scope replacement', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'))
    let resolveRefresh!: () => void
    const invalidateQueries = vi.fn(() => new Promise<void>((resolve) => { resolveRefresh = resolve }))
    let freshness!: FreshnessState
    const root = createRoot(document.createElement('div'))
    const render = (enabled: boolean, userId: string) => createElement(Probe, {
      enabled,
      invalidateQueries,
      scope: { surface: 'authenticated', userId },
      snapshot: (value) => { freshness = value },
    })
    await act(async () => root.render(render(true, 'user-1')))
    act(() => realtime.options?.onStatusChange?.('degraded'))
    await act(async () => vi.advanceTimersByTimeAsync(60_000))

    await act(async () => root.render(render(false, 'user-2')))
    vi.setSystemTime(new Date('2026-08-03T12:01:00Z'))
    await act(async () => resolveRefresh())

    expect(freshness.updatedAt).toBeNull()
    await act(async () => root.unmount())
  })

  it('ignores a degraded refresh that resolves after unmount', async () => {
    vi.useFakeTimers()
    let resolveRefresh!: () => void
    const invalidateQueries = vi.fn(() => new Promise<void>((resolve) => { resolveRefresh = resolve }))
    const snapshot = vi.fn()
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, { invalidateQueries, snapshot })))
    act(() => realtime.options?.onStatusChange?.('degraded'))
    await act(async () => vi.advanceTimersByTimeAsync(60_000))
    const rendersBeforeUnmount = snapshot.mock.calls.length

    await act(async () => root.unmount())
    await act(async () => resolveRefresh())

    expect(snapshot).toHaveBeenCalledTimes(rendersBeforeUnmount)
  })

  it.each([
    { scope: { surface: 'demo' } as QueryScope, userId: 'user-1' },
    { scope: { surface: 'authenticated' } as QueryScope, userId: '' },
  ])('does no degraded work for invalid private scope $scope.surface', async ({ scope, userId }) => {
    vi.useFakeTimers()
    const invalidateQueries = vi.fn()
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      invalidateQueries,
      scope,
      userId,
      snapshot: vi.fn(),
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))
    await act(async () => vi.advanceTimersByTimeAsync(120_000))
    act(() => window.dispatchEvent(new Event('online')))

    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(realtime.recoverOnce).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })

  it('attaches lifecycle listeners only while enabled and degraded', async () => {
    const addWindow = vi.spyOn(window, 'addEventListener')
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    const addDocument = vi.spyOn(document, 'addEventListener')
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, { invalidateQueries: vi.fn(), snapshot: vi.fn() })))
    expect(addWindow).not.toHaveBeenCalledWith('online', expect.any(Function))

    act(() => realtime.options?.onStatusChange?.('degraded'))
    expect(addWindow).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addWindow).toHaveBeenCalledWith('offline', expect.any(Function))
    expect(addDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

    act(() => realtime.options?.onStatusChange?.('connected'))
    expect(removeWindow).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeWindow).toHaveBeenCalledWith('offline', expect.any(Function))
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

    act(() => realtime.options?.onStatusChange?.('degraded'))
    const onlineRemovals = removeWindow.mock.calls.filter(([event]) => event === 'online').length
    await act(async () => root.render(createElement(Probe, {
      enabled: false,
      invalidateQueries: vi.fn(),
      snapshot: vi.fn(),
    })))
    expect(removeWindow.mock.calls.filter(([event]) => event === 'online')).toHaveLength(onlineRemovals + 1)
    await act(async () => root.unmount())
    addWindow.mockRestore()
    removeWindow.mockRestore()
    addDocument.mockRestore()
    removeDocument.mockRestore()
  })

  it('makes only one channel subscribe attempt during degraded recovery', async () => {
    vi.useFakeTimers()
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback: (status: string) => void) => callback('CHANNEL_ERROR')),
      unsubscribe: vi.fn(),
    }
    const manager = new DatabaseRealtimeManager(() => ({ channel: vi.fn(() => channel) }) as never)
    const unsubscribe = manager.subscribe({ tables: ['Trade'], userId: 'user-1', onChange: vi.fn() })
    await vi.runAllTimersAsync()
    expect(channel.subscribe).toHaveBeenCalledTimes(6)

    manager.recoverOnce()
    await vi.runAllTimersAsync()

    expect(channel.subscribe).toHaveBeenCalledTimes(7)
    unsubscribe()
  })

  it('keeps one-shot CLOSED recovery degraded', async () => {
    vi.useFakeTimers()
    let subscription = 0
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback(subscription++ < 6 ? 'CHANNEL_ERROR' : 'CLOSED')
      }),
      unsubscribe: vi.fn(),
    }
    const manager = new DatabaseRealtimeManager(() => ({ channel: vi.fn(() => channel) }) as never)
    const onStatusChange = vi.fn()
    const unsubscribe = manager.subscribe({ tables: ['Trade'], userId: 'user-1', onChange: vi.fn(), onStatusChange })
    await vi.runAllTimersAsync()
    expect(onStatusChange).toHaveBeenLastCalledWith('degraded')

    manager.recoverOnce()
    await Promise.resolve()

    expect(onStatusChange).toHaveBeenLastCalledWith('degraded')
    unsubscribe()
  })
})
