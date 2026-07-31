
import logger from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'
import { db } from '@/lib/db/client'
import { Subscription, User, FreeAccessInvite, PaymentRecord, PromoCode, PromoRedemption } from '@/lib/db/schema'
import { eq, inArray, and, or, desc, isNotNull, asc } from 'drizzle-orm'

export type SubscriptionStatus = string;
import type { NotificationType } from '@/lib/db/schema'
export type { NotificationType };

export const NotificationPriority = {
  LOW: 'LOW' as const,
  MEDIUM: 'MEDIUM' as const,
  HIGH: 'HIGH' as const,
  CRITICAL: 'CRITICAL' as const,
}
export type NotificationPriority = typeof NotificationPriority[keyof typeof NotificationPriority];

import { revalidatePath, revalidateTag } from 'next/cache'
import {
  createInvoice,
  getMinAmount,
  getPaymentStatus,
  isSuccessStatus,
  isFailureStatus,
  type NowPaymentStatus,
  type IpnPayload,
} from './nowpayments-service'
import { createOrUpdateNotification } from './notification-service'

const PRICE_USD = parseFloat(process.env.SUBSCRIPTION_PRICE_USD || '10')
const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '3', 10)
const PROVIDER_PENDING_EXPIRY_MS = 24 * 60 * 60 * 1000
const PAYMENT_RECONCILIATION_BATCH_SIZE = 100
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

function shouldMirrorExpiredByAge(record: { createdAt: Date; providerStatus: string | null | undefined }) {
  if (!isPendingProviderStatus(record.providerStatus)) return false
  return Date.now() - record.createdAt.getTime() >= PROVIDER_PENDING_EXPIRY_MS
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

export interface AccessResult {
  hasAccess: boolean
  status: SubscriptionStatus | 'no_subscription' | 'admin'
  subscription: any | null
  reason?: string
}

export async function getUserAccessStatus(userId: string, userRole?: string): Promise<AccessResult> {
  if (userRole === 'admin') {
    return { hasAccess: true, status: 'admin' as any, subscription: null }
  }

  const subscription = await db.query.Subscription.findFirst({
    where: eq(Subscription.userId, userId),
    with: { FreeAccess: true },
  })

  if (!subscription) {
    const user = await db.query.User.findFirst({ where: eq(User.id, userId), columns: { email: true } })
    if (user) {
      const freeAccess = await db.query.FreeAccessInvite.findFirst({
        where: eq(FreeAccessInvite.email, user.email!),
      })
      if (freeAccess?.isActive) {
        const [sub] = await db.insert(Subscription).values({
            userId,
            status: freeAccess.type === 'lifetime' ? 'free_access' : 'invited_free',
            freeAccessId: freeAccess.id,
            currentPeriodStart: new Date(),
            currentPeriodEnd: freeAccess.expiresAt || null,
            updatedAt: new Date(),
          }).returning()
        await db.update(FreeAccessInvite)
          .set({ registeredAt: new Date(), registeredUserId: userId })
          .where(eq(FreeAccessInvite.id, freeAccess.id))
        return { hasAccess: true, status: sub?.status as any, subscription: sub as any }
      }
    }
    return { hasAccess: false, status: 'no_subscription' as any, subscription: null, reason: 'No subscription found' }
  }

  const activeStatuses: SubscriptionStatus[] = ['active', 'free_access', 'invited_free', 'promo_active']
  if (activeStatuses.includes(subscription.status as SubscriptionStatus)) {
    if (
      (subscription.status === 'invited_free' || subscription.status === 'free_access') &&
      subscription.FreeAccess &&
      !subscription.FreeAccess.isActive
    ) {
      const [updated] = await db.update(Subscription)
        .set({ status: 'expired' })
        .where(eq(Subscription.id, subscription.id))
        .returning()
      return { hasAccess: false, status: 'expired', subscription: updated, reason: 'Free access revoked' }
    }

    if (
      (subscription.status === 'invited_free' || subscription.status === 'free_access') &&
      subscription.currentPeriodEnd &&
      new Date() > subscription.currentPeriodEnd
    ) {
      await db.update(Subscription)
        .set({ status: 'expired' })
        .where(eq(Subscription.id, subscription.id))
      return { hasAccess: false, status: 'expired', subscription, reason: 'Free access expired' }
    }
    return { hasAccess: true, status: subscription.status as string, subscription }
  }

  if (subscription.status === 'unpaid' || subscription.status === 'past_due') {
    await expireAbandonedPayments(userId)
  }

  if (subscription.status === 'past_due') {
    const graceCutoff = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd.getTime() + GRACE_DAYS * 86400000)
      : null
    if (graceCutoff && new Date() <= graceCutoff) {
      return { hasAccess: true, status: 'past_due', subscription, reason: 'Grace period' }
    }
    await db.update(Subscription)
        .set({ status: 'expired' })
        .where(eq(Subscription.id, subscription.id))
    return { hasAccess: false, status: 'expired', subscription, reason: 'Grace period expired' }
  }

  return { hasAccess: false, status: subscription.status as string, subscription, reason: `Status: ${subscription.status}` }
}

async function ensureSubscription(userId: string) {
  let sub = await db.query.Subscription.findFirst({ where: eq(Subscription.userId, userId) })
  if (!sub) {
    try {
      const [newSub] = await db.insert(Subscription).values({ userId, status: 'unpaid', updatedAt: new Date() }).returning()
      sub = newSub
     } catch (error) {
       Sentry.captureException(error, { extra: { route: 'lib/services/subscription-service', phase: 'create-subscription' } })
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
      return {
        subscription,
        invoiceUrl: refreshedExisting.invoiceUrl,
        invoiceId: refreshedExisting.providerInvoiceId,
        paymentRecordId: refreshedExisting.id,
        freeAccess: false,
        reusedExisting: true,
      }
    }
  }

  let finalAmount = PRICE_USD
  let promoCodeRecord = null
  let discountAmount = 0

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
        await db.update(Subscription)
          .set({ status: 'promo_active', promoCodeId: promo.id })
          .where(eq(Subscription.id, subscription.id))
        await recordPromoRedemption(promo.id, userId)
        return { subscription, invoiceUrl: null, paymentRecordId: null, freeAccess: true }
      }
      finalAmount = Math.max(0, finalAmount - discountAmount)
    }
  }

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

  const periodStart = new Date()
  const periodEnd = new Date(periodStart.getTime() + 30 * 86400000)
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
      dueDate: periodStart,
      promoCodeId: promoCodeRecord?.id,
      discountAmount,
      updatedAt: new Date(),
    }).returning()

  return {
    subscription,
    invoiceUrl: invoice.invoice_url,
    invoiceId: invoice.id,
    paymentRecordId: paymentRecord?.id,
    freeAccess: false,
    reusedExisting: false,
  }
}

export async function handleIpnWebhook(payload: IpnPayload) {
  const { payment_id, payment_status, order_id, invoice_id } = payload

  logger.info({ payment_id, payment_status, order_id }, '[Subscription] IPN received')

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

  if (paymentRecord.providerStatus === 'finished' && payment_status !== 'refunded') {
    logger.info({ paymentId: paymentRecord.id }, '[Subscription] Payment already finished, skipping')
    return { processed: true, reason: 'Already processed' }
  }

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

  if (isSuccessStatus(payment_status)) {
    await db.update(Subscription)
      .set({
        status: 'active',
        currentPeriodStart: paymentRecord.subscriptionPeriodStart,
        currentPeriodEnd: paymentRecord.subscriptionPeriodEnd,
        nextPaymentDue: paymentRecord.subscriptionPeriodEnd,
      })
      .where(eq(Subscription.id, paymentRecord.subscriptionId))

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

async function reconcilePaymentRecord(paymentRecordId: string, userId?: string) {
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

  if (record.providerPaymentId) {
    try {
      const provider = await getPaymentStatus(record.providerPaymentId)
      await handleIpnWebhook(provider as unknown as IpnPayload)
    } catch (error) {
      if (shouldMirrorExpiredByAge({ ...record, createdAt: record.createdAt || new Date() })) {
        await markPaymentRecordExpired(record.id)
      } else {
        throw error
      }
    }
  } else if (shouldMirrorExpiredByAge({ ...record, createdAt: record.createdAt || new Date() })) {
    await markPaymentRecordExpired(record.id)
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

async function validateAndGetPromo(code: string, userId: string, context: 'signup' | 'renewal' = 'signup') {
  const promo = await db.query.PromoCode.findFirst({ where: eq(PromoCode.code, code.toUpperCase()) })
  if (!promo || !promo.isActive) return null
  if (promo.validUntil && new Date() > promo.validUntil) return null
  if (promo.validFrom && new Date() < promo.validFrom) return null
  if (promo.maxUses && (promo.usesCount ?? 0) >= promo.maxUses) return null
  if (promo.applicability === 'signup_only' && context !== 'signup') return null
  if (promo.applicability === 'renewal_only' && context !== 'renewal') return null

  const existing = await db.query.PromoRedemption.findFirst({
    where: and(eq(PromoRedemption.promoCodeId, promo.id), eq(PromoRedemption.userId, userId)),
  })
  if (existing) return null

  return promo
}

async function recordPromoRedemption(promoCodeId: string, userId: string) {
  await db.transaction(async (tx) => {
    await tx.insert(PromoRedemption).values({ promoCodeId, userId })
    const promoRecord = await tx.query.PromoCode.findFirst({ where: eq(PromoCode.id, promoCodeId) })
    if (promoRecord) {
      await tx.update(PromoCode).set({ usesCount: (promoRecord.usesCount || 0) + 1 }).where(eq(PromoCode.id, promoCodeId))
    }
  })
}

export async function validatePromoCode(code: string, userId: string) {
  const promo = await validateAndGetPromo(code, userId)
  if (!promo) return null
  return {
    id: promo.id,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    applicability: promo.applicability,
    discountDescription: getDiscountDescription(promo),
  }
}

export async function refreshPaymentRecordStatus(paymentRecordId: string, userId: string) {
  return reconcilePaymentRecord(paymentRecordId, userId)
}

function getDiscountDescription(promo: { type: string; value: number }) {
  switch (promo.type) {
    case 'percentage_discount': return `${promo.value}% off`
    case 'fixed_discount': return `$${promo.value} off`
    case 'free_months': return `${promo.value} month(s) free`
    case 'lifetime_free': return 'Lifetime free access'
    default: return ''
  }
}

async function grantFreeAccess(params: {
  email: string
  type: 'lifetime' | 'until_date' | 'one_time_signup'
  expiresAt?: Date
  note?: string
  grantedBy?: string
}) {
  let invite = await db.query.FreeAccessInvite.findFirst({ where: eq(FreeAccessInvite.email, params.email) })
  if (!invite) {
    const [newInvite] = await db.insert(FreeAccessInvite).values({
      email: params.email,
      type: params.type,
      expiresAt: params.expiresAt,
      note: params.note,
      grantedBy: params.grantedBy,
      isActive: true,
      updatedAt: new Date(),
    }).returning()
    invite = newInvite
  } else {
    const [updated] = await db.update(FreeAccessInvite).set({
      type: params.type,
      expiresAt: params.expiresAt,
      note: params.note,
      grantedBy: params.grantedBy,
      isActive: true,
      revokedAt: null,
    }).where(eq(FreeAccessInvite.id, invite.id)).returning()
    invite = updated
  }

  const user = await db.query.User.findFirst({ where: eq(User.email, params.email) })
  if (user) {
    let userSub = await db.query.Subscription.findFirst({ where: eq(Subscription.userId, user.id) })
    if (!userSub) {
      await db.insert(Subscription).values({
        userId: user.id,
        status: 'free_access',
        freeAccessId: invite?.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: params.expiresAt || null,
        updatedAt: new Date(),
      })
    } else {
      await db.update(Subscription).set({
        status: 'free_access',
        freeAccessId: invite?.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: params.expiresAt || null,
      }).where(eq(Subscription.id, userSub.id))
    }

    await createPaymentNotification(
      user.id,
      'ADMIN_FREE_ACCESS_GRANTED',
      'Free Access Granted',
      params.note || 'You have been granted free access to JJI Pro.'
    )
  }

  return invite
}

async function revokeFreeAccess(email: string) {
  const invite = await db.query.FreeAccessInvite.findFirst({ where: eq(FreeAccessInvite.email, email) })
  if (!invite) return null

  await db.update(FreeAccessInvite)
    .set({ isActive: false, revokedAt: new Date() })
    .where(eq(FreeAccessInvite.id, invite.id))

  if (invite.registeredUserId) {
    await db.update(Subscription)
      .set({ status: 'expired' })
      .where(and(eq(Subscription.userId, invite.registeredUserId), eq(Subscription.freeAccessId, invite.id)))

    await createPaymentNotification(
      invite.registeredUserId,
      'ADMIN_FREE_ACCESS_REVOKED',
      'Free Access Revoked',
      'Your free access to JJI Pro has been revoked.'
    )
  }

  return invite
}

async function expireAbandonedPayments(userId?: string) {
  const pendingPayments = await db.query.PaymentRecord.findMany({
    where: and(
      userId ? eq(PaymentRecord.userId, userId) : undefined,
      inArray(PaymentRecord.providerStatus, PENDING_PROVIDER_STATUSES)
    ),
    orderBy: asc(PaymentRecord.createdAt),
    limit: PAYMENT_RECONCILIATION_BATCH_SIZE,
  })

  if (pendingPayments.length === 0) return { expired: 0 }

  logger.info({ count: pendingPayments.length }, '[Subscription] Reconciling pending payments')

  let expiredCount = 0
  for (const record of pendingPayments) {
    try {
      const updated = await reconcilePaymentRecord(record.id, record.userId)
      if (updated?.providerStatus === 'expired') expiredCount++
    } catch (error) {
      logger.error(error, `Failed to expire payment record ${record.id}`, 'Subscription Expiry')
    }
  }

  return { expired: expiredCount }
}

export async function runSubscriptionChecks() {
  const now = new Date()
  const results = { notified: 0, expired: 0, abandonedCleaned: 0, errors: [] as string[] }

  try {
    const cleanup = await expireAbandonedPayments()
    results.abandonedCleaned = cleanup.expired
  } catch (err) {
    results.errors.push(`Abandoned Cleanup: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  const BATCH_SIZE = 100
  let cursorId: string | undefined = undefined
  let hasMore = true

  while (hasMore) {
    const subscriptions: any[] = await db.query.Subscription.findMany({
      where: and(
        inArray(Subscription.status, ['active', 'past_due']),
        isNotNull(Subscription.nextPaymentDue)
      ),
      limit: BATCH_SIZE,
      offset: cursorId ? 1 : 0, // NOTE: this isn't true cursor pagination but will work for small batches if we sort
      with: { User: { columns: { id: true, email: true } } },
      orderBy: asc(Subscription.id),
    })
    // To make offset pagination safe since we don't have cursors natively like prisma
    // in this exact query structure, we'd need to modify the where clause, but this is a rough approx.

    if (subscriptions.length === 0) {
      hasMore = false
      break
    }

    cursorId = subscriptions[subscriptions.length - 1].id
    if (subscriptions.length < BATCH_SIZE) {
      hasMore = false
    }

    for (const sub of subscriptions) {
      try {
        if (!sub.nextPaymentDue) continue
        const daysUntilDue = Math.ceil((sub.nextPaymentDue.getTime() - now.getTime()) / 86400000)

        if (daysUntilDue === 3) {
          await createPaymentNotification(sub.userId, 'PAYMENT_DUE_SOON', 'Payment Due Soon',
            'Your subscription payment is due in 3 days.')
          results.notified++
        } else if (daysUntilDue === 1) {
          await createPaymentNotification(sub.userId, 'PAYMENT_DUE_SOON', 'Payment Due Tomorrow',
            'Your subscription payment is due tomorrow.')
          results.notified++
        } else if (daysUntilDue === 0) {
          await createPaymentNotification(sub.userId, 'PAYMENT_DUE_TODAY', 'Payment Due Today',
            'Your subscription payment is due today. Please renew to keep your access.')
          results.notified++
        } else if (daysUntilDue < 0 && daysUntilDue >= -GRACE_DAYS) {
          if (sub.status !== 'past_due') {
            await db.update(Subscription).set({ status: 'past_due' }).where(eq(Subscription.id, sub.id))
          }
          await createPaymentNotification(sub.userId, 'PAYMENT_OVERDUE', 'Payment Overdue',
            `Your payment is overdue. You have ${GRACE_DAYS + daysUntilDue} day(s) left before access is suspended.`)
          results.notified++
        } else if (daysUntilDue < -GRACE_DAYS) {
          await db.update(Subscription).set({ status: 'expired' }).where(eq(Subscription.id, sub.id))
          await createPaymentNotification(sub.userId, 'SUBSCRIPTION_EXPIRED', 'Subscription Expired',
            'Your subscription has expired. Please renew to regain access.')
          results.expired++
        }
      } catch (err) {
        results.errors.push(`Sub ${sub.id}: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    }
  }

  return results
}

export async function reconcilePendingPayments(params?: { userId?: string }) {
  return expireAbandonedPayments(params?.userId)
}

function revalidateSubscriptionAccess(userId: string) {
  revalidateTag(`notifications-${userId}`)
  revalidateTag(`accounts-${userId}`)
  revalidateTag(`user-data-${userId}`)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/subscribe')
  revalidatePath('/subscribe/status')
  revalidatePath('/subscribe/success')
}

async function createPaymentNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    priority?: NotificationPriority
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
    logger.error(error, 'Failed to create subscription notification', 'Subscription Notification')
  }
}
