import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FreshnessState, RealtimeStatus } from '@/lib/realtime/types'

const realtime = vi.hoisted(() => ({
  options: null as null | { onStatusChange?: (status: RealtimeStatus) => void },
}))

vi.mock('@/lib/realtime/database-realtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/realtime/database-realtime')>()
  return {
    ...original,
    useDatabaseRealtime: (options: typeof realtime.options) => { realtime.options = options },
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
}: {
  enabled?: boolean
  invalidateQueries: ReturnType<typeof vi.fn>
  snapshot: (freshness: FreshnessState) => void
}) {
  const freshness = useDataProviderRealtime({
    userId: 'user-1',
    enabled,
    queryClient: { invalidateQueries } as never,
    scope: { surface: 'authenticated', userId: 'user-1' },
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
    expect(filter.predicate({ queryKey: ['trades', { surface: 'authenticated', userId: 'user-1' }] })).toBe(true)
    expect(filter.predicate({ queryKey: ['trades', { surface: 'authenticated', userId: 'other-user' }] })).toBe(false)
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

    await act(async () => root.render(createElement(Probe, {
      enabled: false,
      invalidateQueries,
      snapshot: (value) => { freshness = value },
    })))
    await act(async () => vi.advanceTimersByTimeAsync(120_000))
    expect(invalidateQueries).toHaveBeenCalledTimes(2)

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
})
