import { afterEach, describe, expect, it, vi } from 'vitest'

const { apiRequestData } = vi.hoisted(() => ({
  apiRequestData: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  apiRequestData,
}))

import { ApiClientError } from '@/lib/api/errors'
import {
  deleteAccountRequest,
  fetchLiveAccountDetail,
  setAccountArchived,
} from '@/lib/accounts/api'

afterEach(() => {
  apiRequestData.mockReset()
})

describe('account request lifecycle module', () => {
  it('loads a live account detail as a safe read that forwards the route AbortSignal', async () => {
    const signal = new AbortController().signal
    const account = { id: 'acc-1', number: '123', displayName: 'Test' }
    apiRequestData.mockResolvedValueOnce(account)

    await expect(fetchLiveAccountDetail('acc-1', signal)).resolves.toEqual(account)

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toMatch(/^\/api\/v1\/accounts\/acc-1\?t=\d+$/)
    expect(init).toMatchObject({
      signal,
      retry: { mode: 'safe' },
      cache: 'no-store',
      operation: 'load-account-detail',
    })
  })

  it('deletes a live account as a never-retry DELETE against the live endpoint', async () => {
    apiRequestData.mockResolvedValueOnce(null)

    await deleteAccountRequest({ accountType: 'live', accountId: 'acc-1' })

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toBe('/api/v1/accounts/acc-1')
    expect(init).toMatchObject({
      method: 'DELETE',
      retry: { mode: 'never' },
      operation: 'delete-live-account',
    })
  })

  it('deletes a prop-firm account as a never-retry DELETE against the prop-firm endpoint', async () => {
    apiRequestData.mockResolvedValueOnce(null)

    await deleteAccountRequest({ accountType: 'prop-firm', accountId: 'acc-1' })

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toBe('/api/v1/prop-firm/accounts/acc-1')
    expect(init).toMatchObject({
      method: 'DELETE',
      retry: { mode: 'never' },
      operation: 'delete-live-account',
    })
  })

  it('archives an account as a never-retry PATCH with the expected body', async () => {
    apiRequestData.mockResolvedValueOnce(null)

    await setAccountArchived({ accountType: 'live', accountId: 'acc-1' }, true)

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toBe('/api/v1/accounts/acc-1')
    expect(init).toMatchObject({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived: true }),
      retry: { mode: 'never' },
      operation: 'restore-account',
    })
  })

  it('restores a prop-firm account as a never-retry PATCH against the prop-firm endpoint', async () => {
    apiRequestData.mockResolvedValueOnce(null)

    await setAccountArchived({ accountType: 'prop-firm', accountId: 'acc-1' }, false)

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toBe('/api/v1/prop-firm/accounts/acc-1')
    expect(init).toMatchObject({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived: false }),
      retry: { mode: 'never' },
      operation: 'archive-account',
    })
  })

  it('propagates ApiClientError so the component catch/banner behavior still runs', async () => {
    const apiError = new ApiClientError({ message: 'gone', status: 404, kind: 'not_found' })
    apiRequestData.mockRejectedValueOnce(apiError)

    await expect(fetchLiveAccountDetail('acc-1', new AbortController().signal)).rejects.toBe(apiError)
  })
})
