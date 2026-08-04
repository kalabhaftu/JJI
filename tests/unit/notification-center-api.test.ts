import { afterEach, describe, expect, it, vi } from 'vitest'

const { apiRequestData } = vi.hoisted(() => ({
  apiRequestData: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  apiRequestData,
}))

import { ApiClientError } from '@/lib/api/errors'
import {
  clearNotifications,
  deleteNotification,
  loadNotifications,
  loadUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications/api'

afterEach(() => {
  apiRequestData.mockReset()
})

describe('notification API module', () => {
  it('loads notifications as a safe read that forwards the route AbortSignal', async () => {
    const signal = new AbortController().signal
    apiRequestData.mockResolvedValueOnce({ notifications: [], unreadCount: 0 })

    await expect(loadNotifications(signal)).resolves.toEqual({ notifications: [], unreadCount: 0 })

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toMatch(/^\/api\/v1\/notifications\?t=\d+$/)
    expect(init).toMatchObject({
      signal,
      retry: { mode: 'safe' },
      cache: 'no-store',
      operation: 'load-notifications',
    })
  })

  it('loads the unread count as a safe read that forwards the route AbortSignal', async () => {
    const signal = new AbortController().signal
    apiRequestData.mockResolvedValueOnce({ unreadCount: 3 })

    await expect(loadUnreadCount(signal)).resolves.toEqual({ unreadCount: 3 })

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toMatch(/^\/api\/v1\/notifications\?unreadOnly=true&limit=1&t=\d+$/)
    expect(init).toMatchObject({
      signal,
      retry: { mode: 'safe' },
      cache: 'no-store',
      operation: 'load-unread-notification-count',
    })
  })

  it('marks a notification read as a never-retry PATCH with the expected body', async () => {
    apiRequestData.mockResolvedValueOnce(null)

    await expect(markNotificationRead('notif-1')).resolves.toBeNull()

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toBe('/api/v1/notifications/notif-1')
    expect(init).toMatchObject({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
      retry: { mode: 'never' },
      operation: 'mark-notification-read',
    })
  })

  it('marks all notifications read as a never-retry PATCH', async () => {
    apiRequestData.mockResolvedValueOnce(null)

    await markAllNotificationsRead()

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toBe('/api/v1/notifications')
    expect(init).toMatchObject({
      method: 'PATCH',
      retry: { mode: 'never' },
      operation: 'mark-all-notifications-read',
    })
  })

  it('deletes a notification as a never-retry DELETE', async () => {
    apiRequestData.mockResolvedValueOnce(null)

    await deleteNotification('notif-2')

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toBe('/api/v1/notifications/notif-2')
    expect(init).toMatchObject({
      method: 'DELETE',
      retry: { mode: 'never' },
      operation: 'delete-notification',
    })
  })

  it('clears all notifications as a never-retry DELETE', async () => {
    apiRequestData.mockResolvedValueOnce(null)

    await clearNotifications()

    expect(apiRequestData).toHaveBeenCalledTimes(1)
    const [url, init] = apiRequestData.mock.calls[0]
    expect(url).toBe('/api/v1/notifications')
    expect(init).toMatchObject({
      method: 'DELETE',
      retry: { mode: 'never' },
      operation: 'clear-notifications',
    })
  })

  it('propagates ApiClientError so the component catch/toast/report behavior still runs', async () => {
    const apiError = new ApiClientError({ message: 'boom', status: 503, kind: 'server' })
    apiRequestData.mockRejectedValueOnce(apiError)

    await expect(loadNotifications(new AbortController().signal)).rejects.toBe(apiError)
  })
})
