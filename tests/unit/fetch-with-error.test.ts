import { afterEach, describe, expect, it, vi } from 'vitest'

import { composeAbortSignals } from '@/lib/api/signals'
import { fetchWithError } from '@/lib/utils/fetch-with-error'

afterEach(() => vi.restoreAllMocks())

describe('fetch request lifecycle', () => {
  it('preserves caller cancellation instead of reporting a timeout', async () => {
    const caller = new AbortController()
    const fetchMock = vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      if (init.signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    vi.stubGlobal('fetch', fetchMock)
    caller.abort()

    const result = await fetchWithError('/api/test', { signal: caller.signal, retries: 3 })
    expect(result.error).toMatchObject({ code: 'CANCELLED', isTimeout: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry unsafe mutations', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchWithError('/api/test', { method: 'POST', retries: 3 })
    expect(result.error?.isNetworkError).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('composes caller and timeout signals', () => {
    const caller = new AbortController()
    const composed = composeAbortSignals(caller.signal, 1000)
    caller.abort()
    expect(composed.signal.aborted).toBe(true)
    expect(composed.didTimeout()).toBe(false)
    composed.cleanup()
  })
})
