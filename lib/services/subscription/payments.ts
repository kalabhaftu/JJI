import { and, desc, eq, inArray, or } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { PaymentRecord, Subscription } from '@/lib/db/schema'
import logger from '@/lib/logger'
import { reportError } from '@/lib/observability/report-error'
import {
  createInvoice,
  getMinAmount,
  getPaymentStatus,
  isFailureStatus,
  isSuccessStatus,
  type IpnPayload,
  type NowPaymentStatus,
} from '@/lib/services/nowpayments-service'
import {
  createPaymentNotification,
  revalidateSubscriptionAccess,
} from '@/lib/services/subscription/notifications'
import {
  recordPromoRedemption,
  validateAndGetPromo,
} from '@/lib/services/subscription/promotions'
import { NotificationPriority } from '@/lib/services/subscription/types'

const PRICE_USD = Number.parseFloat(process.env.SUBSCRIPTION_PRICE_USD || '10')
const PAYMENT_LINK_EXPIRY_MS = 30 * 60 * 1000
const PENDING_PROVIDER_STATUSES: Array<NowPaymentStatus | 'pending'> = [
  'pending',
  'waiting',
  'confirming',
  'confirmed',
  'sending',
  'partially_paid',
]

function isPendingProviderStatus(status: string | null | undefined): status is NowPaymentStatus {
  return typeof status === 'string' && PENDING_PROVIDER_STATUSES.includes(status as NowPaymentStatus)
}

function amountsMatch(actual: number | string | null | undefined, expected: number) {
  const value = Number(actual)
  return Number.isFinite(value) && Math.abs(value - expected) < 0.01
}

function getPaymentDeadline(record: { createdAt: Date; dueDate?: Date | null }) {
  return record.dueDate || new Date(record.createdAt.getTime() + PAYMENT_LINK_EXPIRY_MS)
}

function shouldMirrorExpiredByAge(record: { createdAt: Date; dueDate?: Date | null; providerStatus: string | null | undefined }) {
  if (!isPendingProviderStatus(record.providerStatus)) return false
  return new Date() >= getPaymentDeadline(record)
}

function validateIpnPayload(paymentRecord: any, payload: IpnPayload) {
  if (!paymentRecord) return 'Payment record not found'

  if (paymentRecord.providerInvoiceId && String(payload.invoice_id) !== paymentRecord.providerInvoiceId) {
    return 'Payment invoice mismatch'
  }

  if (!amountsMatch(payload.price_amount, paymentRecord.amountUsd)) {
    return 'Payment amount mismatch'
  }

  if (String(payload.price_currency || '').toLowerCase() !== 'usd') {
    return 'Payment currency mismatch'
  }

  return null
}

async function ensureSubscription(userId: string) {
  let sub = await db.query.Subscription.findFirst({ where: eq(Subscription.userId, userId) })
  if (!sub) {
    try {
      const [newSub] = await db.insert(Subscription).values({ userId, status: 'unpaid', updatedAt: new Date() }).returning()
      sub = newSub
     } catch (error) {
       reportError(error, {
         surface: 'server',
         operation: 'create-subscription',
         userId,
         extra: { concurrentInsertFallback: true },
       })
       sub = await db.query.Subscription.findFirst({ where: eq(Subscription.userId, userId) })
     }
  }
  return sub! as any
}

async function getLatestPendingPaymentRecord(userId: string, subscriptionId: string) {
  return db.query.PaymentRecord.findFirst({
    where: and(
      eq(PaymentRecord.userId, userId),
      eq(PaymentRecord.subscriptionId, subscriptionId),
      inArray(PaymentRecord.providerStatus, PENDING_PROVIDER_STATUSES)
    ),
    orderBy: desc(PaymentRecord.createdAt),
  })
}

export async function createSubscriptionInvoice(
  userId: string,
  options?: { promoCode?: string; payCurrency?: string; context?: 'signup' | 'renewal' }
) {
  const subscription = await ensureSubscription(userId)
  if (['active', 'free_access', 'invited_free', 'promo_active'].includes(subscription.status)) {
    return { subscription, invoiceUrl: null, paymentRecordId: null, alreadyActive: true, freeAccess: false }
  }

  const existingPending = await getLatestPendingPaymentRecord(userId, subscription.id)
  if (existingPending) {
    const refreshedExisting = await reconcilePaymentRecord(existingPending.id, userId)
    if (refreshedExisting && isPendingProviderStatus(refreshedExisting.providerStatus)) {
      const deadline = getPaymentDeadline({ createdAt: refreshedExisting.createdAt || new Date(), dueDate: refreshedExisting.dueDate })
      return {
        subscription,
        invoiceUrl: refreshedExisting.invoiceUrl,
        invoiceId: refreshedExisting.providerInvoiceId,
        paymentRecordId: refreshedExisting.id,
        expiresAt: deadline,
        freeAccess: false,
        reusedExisting: true,
      }
    }
  }

  let finalAmount = PRICE_USD
  let promoCodeRecord = null
  let discountAmount = 0

  // Apply promo code if provided
  if (options?.promoCode) {
    const promo = await validateAndGetPromo(options.promoCode, userId, options.context || 'signup')
    if (promo) {
      promoCodeRecord = promo
      if (promo.type === 'percentage_discount') {
        discountAmount = finalAmount * (promo.value / 100)
      } else if (promo.type === 'fixed_discount') {
        discountAmount = Math.min(promo.value, finalAmount)
      } else if (promo.type === 'free_months') {
        discountAmount = finalAmount // First month free
      } else if (promo.type === 'lifetime_free') {
        // Grant lifetime free access
        await db.update(Subscription)
          .set({ status: 'promo_active', promoCodeId: promo.id })
          .where(eq(Subscription.id, subscription.id))
        await recordPromoRedemption(promo.id, userId)
        return { subscription, invoiceUrl: null, paymentRecordId: null, freeAccess: true }
      }
      finalAmount = Math.max(0, finalAmount - discountAmount)
    }
  }

  // If amount is 0 after discount, activate directly
  if (finalAmount <= 0) {
    const now = new Date()
    const freeMonths = promoCodeRecord?.type === 'free_months' ? Math.max(1, Math.floor(promoCodeRecord.value)) : 1
    const periodEnd = new Date(now.getTime() + freeMonths * 30 * 86400000)
    await db.update(Subscription)
      .set({
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextPaymentDue: periodEnd,
        promoCodeId: promoCodeRecord?.id,
      })
      .where(eq(Subscription.id, subscription.id))
    if (promoCodeRecord) await recordPromoRedemption(promoCodeRecord.id, userId)
    return { subscription, invoiceUrl: null, paymentRecordId: null, freeAccess: true }
  }

  // Create NOWPayments invoice
  const periodStart = new Date()
  const periodEnd = new Date(periodStart.getTime() + 30 * 86400000)
  const paymentDeadline = new Date(periodStart.getTime() + PAYMENT_LINK_EXPIRY_MS)
  const orderId = `sub_${subscription.id}_${Date.now()}`
  const payCurrency = options?.payCurrency?.trim().toLowerCase()

  if (payCurrency) {
    const minAmount = await getMinAmount('usd', payCurrency)
    if (minAmount && finalAmount < minAmount) {
      throw new Error(`Payment amount is below NOWPayments minimum for ${payCurrency.toUpperCase()}`)
    }
  }

  const invoice = await createInvoice({
    price_amount: finalAmount,
    price_currency: 'usd',
    ...(payCurrency !== undefined && { pay_currency: payCurrency }),
    order_id: orderId,
    order_description: `JJI Pro - Monthly Subscription`,
  })

  // Create payment record
  const [paymentRecord] = await db.insert(PaymentRecord).values({
      userId,
      subscriptionId: subscription.id,
      amountUsd: finalAmount,
      providerInvoiceId: invoice.id,
      invoiceUrl: invoice.invoice_url,
      providerStatus: 'waiting',
      payCurrency: payCurrency || null,
      subscriptionPeriodStart: periodStart,
      subscriptionPeriodEnd: periodEnd,
      dueDate: paymentDeadline,
      promoCodeId: promoCodeRecord?.id,
      discountAmount,
      updatedAt: new Date(),
    }).returning()

  return {
    subscription,
    invoiceUrl: invoice.invoice_url,
    invoiceId: invoice.id,
    paymentRecordId: paymentRecord?.id,
    expiresAt: paymentDeadline,
    freeAccess: false,
    reusedExisting: false,
  }
}

export async function handleIpnWebhook(payload: IpnPayload) {
  const { payment_id, payment_status, order_id, invoice_id } = payload

  logger.info({ payment_id, payment_status, order_id }, '[Subscription] IPN received')

  // Find the payment record by invoice ID or order_id
  const lookupClauses = [
    invoice_id ? eq(PaymentRecord.providerInvoiceId, String(invoice_id)) : null,
    payment_id ? eq(PaymentRecord.providerPaymentId, String(payment_id)) : null,
  ].filter(Boolean) as any[]

  if (lookupClauses.length === 0) {
    return { processed: false, reason: 'Missing payment identifiers' }
  }

  let paymentRecord = await db.query.PaymentRecord.findFirst({
    where: or(...lookupClauses),
    with: { Subscription: true },
  })

  if (!paymentRecord) {
    logger.warn({ payment_id, invoice_id, order_id }, '[Subscription] No payment record found for IPN')
    return { processed: false, reason: 'Payment record not found', status: 404 }
  }

  const validationError = validateIpnPayload(paymentRecord, payload)
  if (validationError) {
    logger.warn({ reason: validationError, payment_id, invoice_id, order_id }, '[Subscription] Rejected IPN payload')
    return { processed: false, reason: validationError, status: 400 }
  }

  if (isSuccessStatus(payment_status) && shouldMirrorExpiredByAge({
    createdAt: paymentRecord.createdAt || new Date(),
    dueDate: paymentRecord.dueDate,
    providerStatus: paymentRecord.providerStatus,
  })) {
    await db.update(PaymentRecord)
      .set({
        providerPaymentId: String(payment_id),
        payCurrency: payload.pay_currency,
        payAmount: payload.pay_amount,
        rawProviderPayload: payload as any,
        providerStatus: 'expired',
        expiredAt: paymentRecord.expiredAt || new Date(),
      })
      .where(eq(PaymentRecord.id, paymentRecord.id))
    logger.warn({ paymentId: paymentRecord.id }, '[Subscription] Received successful provider payment after local payment window')
    revalidateSubscriptionAccess(paymentRecord.userId)
    return { processed: true, reason: 'Payment arrived after local expiration', status: 'expired' }
  }

  // Idempotency: skip if already in terminal state
  if (paymentRecord.providerStatus === 'finished' && payment_status !== 'refunded') {
    logger.info({ paymentId: paymentRecord.id }, '[Subscription] Payment already finished, skipping')
    return { processed: true, reason: 'Already processed' }
  }

  // Update payment record
  const updateData: any = {
    providerStatus: payment_status,
    providerPaymentId: String(payment_id),
    payCurrency: payload.pay_currency,
    payAmount: payload.pay_amount,
    rawProviderPayload: payload as any,
  }

  if (isSuccessStatus(payment_status)) {
    updateData.paidAt = new Date()
    updateData.expiredAt = null
  } else if (isFailureStatus(payment_status)) {
    updateData.expiredAt = new Date()
  }

  await db.update(PaymentRecord)
    .set(updateData)
    .where(eq(PaymentRecord.id, paymentRecord.id))

  // Update subscription status based on payment outcome
  if (isSuccessStatus(payment_status)) {
    await db.update(Subscription)
      .set({
        status: 'active',
        currentPeriodStart: paymentRecord.subscriptionPeriodStart,
        currentPeriodEnd: paymentRecord.subscriptionPeriodEnd,
        nextPaymentDue: paymentRecord.subscriptionPeriodEnd,
      })
      .where(eq(Subscription.id, paymentRecord.subscriptionId))

    // Create success notification
    await createPaymentNotification(
      paymentRecord.userId,
      'PAYMENT_RECEIVED',
      'Payment Confirmed',
      `Your subscription payment of $${paymentRecord.amountUsd} has been confirmed. Access is active until ${paymentRecord.subscriptionPeriodEnd?.toLocaleDateString()}.`,
      {
        priority: NotificationPriority.HIGH,
        invalidationKey: `payment-received-${paymentRecord.subscriptionId}`,
      }
    )
    await createPaymentNotification(
      paymentRecord.userId,
      'ACCESS_RESTORED',
      'Access Restored',
      'Your JJI Pro access is active again.',
      {
        priority: NotificationPriority.HIGH,
        invalidationKey: `access-restored-${paymentRecord.subscriptionId}`,
      }
    )
  } else if (isFailureStatus(payment_status)) {
    await createPaymentNotification(
      paymentRecord.userId,
      'PAYMENT_FAILED',
      'Payment Failed',
      `Your payment of $${paymentRecord.amountUsd} ${payment_status}. Please try again to maintain access.`,
      {
        priority: NotificationPriority.HIGH,
        invalidationKey: `payment-failed-${paymentRecord.id}`,
      }
    )
  }

  revalidateSubscriptionAccess(paymentRecord.userId)

  return { processed: true, status: payment_status }
}

async function markPaymentRecordExpired(recordId: string) {
  await db.update(PaymentRecord)
    .set({
      providerStatus: 'expired',
      expiredAt: new Date(),
    })
    .where(eq(PaymentRecord.id, recordId))
}

export async function reconcilePaymentRecord(paymentRecordId: string, userId?: string) {
  const record = await db.query.PaymentRecord.findFirst({
    where: and(
      eq(PaymentRecord.id, paymentRecordId),
      userId ? eq(PaymentRecord.userId, userId) : undefined
    ),
    with: {
      Subscription: true,
    },
  })

  if (!record) return null
  if (record.providerStatus && ['finished', 'failed', 'expired', 'refunded'].includes(record.providerStatus)) {
    return record
  }

  if (shouldMirrorExpiredByAge({ ...record, createdAt: record.createdAt || new Date() })) {
    await markPaymentRecordExpired(record.id)
    return db.query.PaymentRecord.findFirst({
      where: and(
        eq(PaymentRecord.id, paymentRecordId),
        userId ? eq(PaymentRecord.userId, userId) : undefined
      ),
      with: {
        Subscription: true,
      },
    }) as any
  }

  if (record.providerPaymentId) {
    try {
      const provider = await getPaymentStatus(record.providerPaymentId)
      await handleIpnWebhook(provider as unknown as IpnPayload)
    } catch (error) {
      throw error
    }
  }

  return db.query.PaymentRecord.findFirst({
    where: and(
      eq(PaymentRecord.id, paymentRecordId),
      userId ? eq(PaymentRecord.userId, userId) : undefined
    ),
    with: {
      Subscription: true,
    },
  }) as any
}

export async function refreshPaymentRecordStatus(paymentRecordId: string, userId: string) {
  return reconcilePaymentRecord(paymentRecordId, userId)
}
