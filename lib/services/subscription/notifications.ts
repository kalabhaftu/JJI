import type { NotificationType } from '@/lib/db/schema'
import { reportError } from '@/lib/observability/report-error'
import { createOrUpdateNotification } from '@/lib/services/notification-service'
import {
  NotificationPriority,
  type NotificationPriority as NotificationPriorityValue,
} from '@/lib/services/subscription/types'
import { revalidatePath, revalidateTag } from 'next/cache'

export function revalidateSubscriptionAccess(userId: string) {
  revalidateTag(`notifications-${userId}`)
  revalidateTag(`accounts-${userId}`)
  revalidateTag(`user-data-${userId}`)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/subscribe')
  revalidatePath('/subscribe/status')
  revalidatePath('/subscribe/success')
}

export async function createPaymentNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    priority?: NotificationPriorityValue
    invalidationKey?: string
  }
) {
  try {
    await createOrUpdateNotification(userId, {
      type,
      title,
      message,
      priority: options?.priority || (type === 'SUBSCRIPTION_EXPIRED' ? NotificationPriority.CRITICAL : NotificationPriority.HIGH),
      ...(options?.invalidationKey ? { invalidationKey: options.invalidationKey } : {}),
    })
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'create-subscription-notification',
      userId,
    })
  }
}
