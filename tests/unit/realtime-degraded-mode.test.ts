import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FreshnessState, RealtimeStatus } from '@/lib/realtime/types'

const realtime = vi.hoisted(() => ({
  options: null as null | { onStatusChange?: (status: RealtimeStatus) => void },
  reconnect: vi.fn(),
}))

vi.mock('@/lib/realtime/database-realtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/realtime/database-realtime')>()
  return {
    ...original,
    useDatabaseRealtime: (options: typeof realtime.options) => { realtime.options = options },
    reconnectDatabaseRealtime: realtime.reconnect,
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
  snapshot,
  scope = { surface: 'authenticated', userId: 'user-1' },
}: {
  enabled?: boolean
  invalidateQueries: ReturnType<typeof vi.fn>
  snapshot: (freshness: FreshnessState) => void
  scope?: { surface: 'authenticated'; userId: string }
}) {
  const freshness = useDataProviderRealtime({
    userId: 'user-1',
    enabled,
    queryClient: { invalidateQueries } as never,
    scope,
    reloadBootstrapData: vi.fn(),
  })
  snapshot(freshness)
  return null
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
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
    manager.reconnect()
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
    expect(realtime.reconnect).toHaveBeenCalledTimes(1)

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
    expect(realtime.reconnect).toHaveBeenCalledTimes(2)

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
    realtime.reconnect.mockImplementationOnce(() => realtime.options?.onStatusChange?.('connected'))
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      snapshot: (value) => { freshness = value },
    })))
    act(() => realtime.options?.onStatusChange?.('degraded'))
    act(() => setVisibility('hidden'))

    await act(async () => setVisibility('visible'))

    expect(realtime.reconnect).toHaveBeenCalledTimes(1)
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

    expect(realtime.reconnect).toHaveBeenCalledTimes(1)
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
})
