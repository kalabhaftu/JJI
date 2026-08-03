import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchWithError } from '@/lib/utils/fetch-with-error'

afterEach(() => vi.restoreAllMocks())

describe('fetchWithError unsafe response retry policy', () => {
  it.each([500, 408, 429])('does not retry %s responses for POST by default', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', {
      status,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchWithError('/api/mutate', { method: 'POST', retries: 3 })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(status)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
