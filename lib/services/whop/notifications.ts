import 'server-only'

import { escapeHtml, sendEmail } from '@/lib/email'
import { createPaymentNotification, revalidateSubscriptionAccess } from '@/lib/services/subscription/notifications'
import { NotificationPriority } from '@/lib/services/subscription/types'

export async function sendWhopWelcomeEmail(input: {
  email: string
  firstName?: string | null
  membershipId: string
  requestId?: string
}) {
  const name = input.firstName?.trim() || 'Trader'
  return sendEmail({
    to: input.email,
    subject: 'Welcome to JJI Pro',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
        <h1 style="font-size:24px">Welcome to JJI Pro</h1>
        <p>Hi ${escapeHtml(name)},</p>
        <p>Your card subscription is active. Your dashboard and all Pro tools are ready.</p>
        <p><a href="https://www.justjournalit.site/dashboard">Open your dashboard</a></p>
      </div>
    `,
    idempotencyKey: `whop-welcome-${input.membershipId}`,
    operation: 'send-whop-welcome-email',
    entityId: input.membershipId,
    ...(input.requestId ? { requestId: input.requestId } : {}),
  })
}

export async function notifyWhopMembershipStatus(input: {
  userId: string
  membershipId: string
  previousStatus: string | null
  status: string
}) {
  if (input.previousStatus === input.status) return

  if (input.status === 'active') {
    await createPaymentNotification(
      input.userId,
      'ACCESS_RESTORED',
      'JJI Pro is active',
      'Your card subscription is active and Pro access is ready.',
      {
        priority: NotificationPriority.HIGH,
        invalidationKey: `whop-access-${input.membershipId}`,
      },
    )
  } else if (input.status === 'past_due') {
    await createPaymentNotification(
      input.userId,
      'PAYMENT_OVERDUE',
      'Card payment needs attention',
      'Whop reported a past-due payment. Update billing before the grace period ends.',
      {
        priority: NotificationPriority.HIGH,
        invalidationKey: `whop-past-due-${input.membershipId}`,
      },
    )
  } else if (input.status === 'expired' || input.status === 'cancelled') {
    await createPaymentNotification(
      input.userId,
      'SUBSCRIPTION_EXPIRED',
      'Card subscription ended',
      'Your Whop subscription is no longer active.',
      {
        priority: NotificationPriority.CRITICAL,
        invalidationKey: `whop-ended-${input.membershipId}`,
      },
    )
  }

  revalidateSubscriptionAccess(input.userId)
}

export async function notifyWhopPayment(input: {
  userId: string
  paymentId: string
  status: string
  amountUsd: number
}) {
  if (input.status === 'succeeded') {
    await createPaymentNotification(
      input.userId,
      'PAYMENT_RECEIVED',
      'Card payment received',
      `Your $${input.amountUsd.toFixed(2)} payment was confirmed.`,
      {
        priority: NotificationPriority.HIGH,
        invalidationKey: `whop-payment-${input.paymentId}`,
      },
    )
  } else if (input.status === 'failed' || input.status === 'past_due') {
    await createPaymentNotification(
      input.userId,
      'PAYMENT_FAILED',
      'Card payment failed',
      'Whop could not complete your latest card payment. Review your billing details.',
      {
        priority: NotificationPriority.HIGH,
        invalidationKey: `whop-payment-failed-${input.paymentId}`,
      },
    )
  }
}
