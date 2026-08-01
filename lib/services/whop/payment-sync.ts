import 'server-only'

import { eq } from 'drizzle-orm'
import type { Payment } from '@whop/sdk/resources'

import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import { PaymentRecord } from '@/lib/db/schema'
import { getWhopClient } from '@/lib/services/whop/client'
import { syncWhopMembership } from '@/lib/services/whop/membership-sync'
import { notifyWhopPayment } from '@/lib/services/whop/notifications'

function parseProviderDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function paymentAmountUsd(payment: Payment): number {
  if (payment.usd_total !== null) return payment.usd_total
  if (payment.settlement_currency === 'usd') return payment.settlement_amount
  if (payment.currency === 'usd' && payment.subtotal !== null) return payment.subtotal
  const configured = Number(process.env.SUBSCRIPTION_PRICE_USD || '10')
  return Number.isFinite(configured) && configured >= 0 ? configured : 10
}

export async function syncWhopPayment(
  payment: Payment,
  context: { requestId?: string } = {},
) {
  const membershipId = payment.membership?.id
  if (!membershipId) throw new Error('Whop payment is missing its membership')

  const membership = await getWhopClient().memberships.retrieve(membershipId)
  const membershipResult = await syncWhopMembership(membership, context)
  const amountUsd = paymentAmountUsd(payment)
  const providerStatus = payment.substatus || payment.status || 'unknown'
  const paidAt = parseProviderDate(payment.paid_at)

  const paymentRecord = await db.transaction(async (tx) => {
    const [stored] = await tx.insert(PaymentRecord).values({
      userId: membershipResult.internalUserId,
      subscriptionId: membershipResult.subscription.id,
      planId: 'pro',
      amountUsd,
      provider: 'whop',
      providerPaymentId: payment.id,
      providerStatus,
      payCurrency: payment.currency,
      payAmount: payment.settlement_amount,
      subscriptionPeriodStart: membershipResult.storedMembership.currentPeriodStart,
      subscriptionPeriodEnd: membershipResult.storedMembership.currentPeriodEnd,
      paidAt,
      rawProviderPayload: null,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: PaymentRecord.providerPaymentId,
      set: {
        userId: membershipResult.internalUserId,
        subscriptionId: membershipResult.subscription.id,
        amountUsd,
        provider: 'whop',
        providerStatus,
        payCurrency: payment.currency,
        payAmount: payment.settlement_amount,
        subscriptionPeriodStart: membershipResult.storedMembership.currentPeriodStart,
        subscriptionPeriodEnd: membershipResult.storedMembership.currentPeriodEnd,
        paidAt,
        rawProviderPayload: null,
        updatedAt: new Date(),
      },
    }).returning()
    if (!stored) throw new Error('Failed to persist Whop payment')

    await recordAuditEvent({
      userId: membershipResult.internalUserId,
      action: 'WHOP_PAYMENT_SYNCED',
      entityType: 'PaymentRecord',
      entityId: payment.id,
      source: 'background-job',
      requestId: context.requestId ?? null,
      afterData: { provider: 'whop', providerStatus, amountUsd },
    }, tx as never)

    return stored
  })

  await notifyWhopPayment({
    userId: membershipResult.internalUserId,
    paymentId: payment.id,
    status: providerStatus,
    amountUsd,
  })

  return paymentRecord
}

export async function reconcileWhopPayment(
  paymentId: string,
  context: { requestId?: string } = {},
) {
  const payment = await getWhopClient().payments.retrieve(paymentId)
  return syncWhopPayment(payment, context)
}

export async function reconcileWhopRefund(
  refundId: string,
  context: { requestId?: string } = {},
) {
  const refund = await getWhopClient().refunds.retrieve(refundId)
  const paymentId = refund.payment?.id
  if (!paymentId) throw new Error('Whop refund is missing its payment')
  const record = await reconcileWhopPayment(paymentId, context)
  await db.update(PaymentRecord).set({
    providerStatus: refund.status === 'succeeded' ? 'refunded' : `refund_${refund.status}`,
    updatedAt: new Date(),
  }).where(eq(PaymentRecord.id, record.id))
  return record
}
