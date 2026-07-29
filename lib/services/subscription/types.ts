import type { NotificationType } from '@/lib/db/schema'

export type SubscriptionStatus = string
export type { NotificationType }

export const NotificationPriority = {
  LOW: 'LOW' as const,
  MEDIUM: 'MEDIUM' as const,
  HIGH: 'HIGH' as const,
  CRITICAL: 'CRITICAL' as const,
}
export type NotificationPriority =
  typeof NotificationPriority[keyof typeof NotificationPriority]
