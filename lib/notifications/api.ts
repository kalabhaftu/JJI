'use client'

import { apiRequestData } from '@/lib/api/client'
import type { NotificationRow } from '@/lib/db/schema/users'

export interface NotificationList {
  notifications: NotificationRow[]
  unreadCount: number
}

export interface UnreadCount {
  unreadCount: number
}

export function loadNotifications(signal: AbortSignal): Promise<NotificationList> {
  return apiRequestData<NotificationList>(`/api/v1/notifications?t=${Date.now()}`, {
    signal,
    retry: { mode: 'safe' },
    cache: 'no-store',
    operation: 'load-notifications',
  })
}

export function loadUnreadCount(signal: AbortSignal): Promise<UnreadCount> {
  return apiRequestData<UnreadCount>(`/api/v1/notifications?unreadOnly=true&limit=1&t=${Date.now()}`, {
    signal,
    retry: { mode: 'safe' },
    cache: 'no-store',
    operation: 'load-unread-notification-count',
  })
}

export function markNotificationRead(notificationId: string): Promise<unknown> {
  return apiRequestData<unknown>(`/api/v1/notifications/${notificationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isRead: true }),
    retry: { mode: 'never' },
    operation: 'mark-notification-read',
  })
}

export function markAllNotificationsRead(): Promise<unknown> {
  return apiRequestData<unknown>('/api/v1/notifications', {
    method: 'PATCH',
    retry: { mode: 'never' },
    operation: 'mark-all-notifications-read',
  })
}

export function deleteNotification(notificationId: string): Promise<unknown> {
  return apiRequestData<unknown>(`/api/v1/notifications/${notificationId}`, {
    method: 'DELETE',
    retry: { mode: 'never' },
    operation: 'delete-notification',
  })
}

export function clearNotifications(): Promise<unknown> {
  return apiRequestData<unknown>('/api/v1/notifications', {
    method: 'DELETE',
    retry: { mode: 'never' },
    operation: 'clear-notifications',
  })
}
