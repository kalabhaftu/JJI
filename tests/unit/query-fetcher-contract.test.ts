import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetcher, postFetcher } from '@/lib/query/fetcher'

const { apiRequestData } = vi.hoisted(() => ({ apiRequestData: vi.fn() }))
vi.mock('@/lib/api/client', () => ({ apiRequestData }))

afterEach(() => vi.restoreAllMocks())

describe('query fetcher canonical API contract', () => {
  it('passes the query signal to canonical safe reads', async () => {
    apiRequestData.mockResolvedValue({ trades: [] })
    const signal = new AbortController().signal
    await fetcher('/api/trades', signal)
    expect(apiRequestData).toHaveBeenCalledWith('/api/trades', expect.objectContaining({ signal, retry: { mode: 'safe' } }))
  })

  it('marks mutations as never retry', async () => {
    apiRequestData.mockResolvedValue({ success: true })
    await postFetcher('/api/trades', { accountId: 'a' })
    expect(apiRequestData).toHaveBeenCalledWith('/api/trades', expect.objectContaining({ retry: { mode: 'never' } }))
  })
})
