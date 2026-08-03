import { describe, expect, it, vi } from 'vitest'
import { DatabaseRealtimeManager } from '@/lib/realtime/database-realtime'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('DatabaseRealtimeManager session generations', () => {
  it('does not install an old async channel after the user session is replaced', async () => {
    const firstSubscription = deferred<void>()
    const firstChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback: (status: string) => void) => {
        void firstSubscription.promise.then(() => callback('SUBSCRIBED'))
      }),
      unsubscribe: vi.fn(),
    }
    const secondChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    }
    const supabase = {
      channel: vi.fn()
        .mockReturnValueOnce(firstChannel)
        .mockReturnValueOnce(secondChannel),
    }
    const manager = new DatabaseRealtimeManager(() => supabase as never)
    const firstStatus = vi.fn()

    const stopFirst = manager.subscribe({ tables: ['Account'], userId: 'user-a', onChange: vi.fn(), onStatusChange: firstStatus })
    stopFirst()
    manager.subscribe({ tables: ['Account'], userId: 'user-b', onChange: vi.fn() })

    firstSubscription.resolve()
    await Promise.resolve()

    expect(manager.getChannelForTest()).toBe(secondChannel)
    expect(secondChannel.subscribe).toHaveBeenCalled()
    expect(firstStatus).not.toHaveBeenCalled()
  })
})
