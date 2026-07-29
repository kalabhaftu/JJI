import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import { refreshPaymentRecordStatus } from '@/lib/services/subscription-service'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

const PENDING_PROVIDER_STATUSES = new Set(['pending', 'waiting', 'confirming', 'confirmed', 'sending', 'partially_paid'])

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(
    request,
    request.nextUrl.searchParams.get('refresh') === 'true' ? 'payment' : 'authenticated-read',
  )
  if (limited) return limited
  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const paymentRecordId = request.nextUrl.searchParams.get('paymentRecordId')
    if (!paymentRecordId) {
      return createErrorResponse('Missing paymentRecordId', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    const shouldRefresh = request.nextUrl.searchParams.get('refresh') === 'true'
    if (shouldRefresh) {
      await refreshPaymentRecordStatus(paymentRecordId, identity.internalUserId)
    }

    const record = await db.query.PaymentRecord.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, paymentRecordId), eq(table.userId, identity.internalUserId)),
      with: {
        Subscription: true,
      },
    })

    if (!record) {
      return createErrorResponse('Payment not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    const deadline = record.dueDate || (record.createdAt ? new Date(record.createdAt.getTime() + 30 * 60 * 1000) : null)
    const isPending = Boolean(record.providerStatus && PENDING_PROVIDER_STATUSES.has(record.providerStatus))
    const canOpenInvoice = Boolean(record.invoiceUrl && isPending && deadline && deadline > new Date())
    const paymentUrl = canOpenInvoice
      ? new URL(`/api/v1/payments/redirect?paymentRecordId=${encodeURIComponent(record.id)}`, request.url).toString()
      : null

    const payload = {
      id: record.id,
      providerStatus: record.providerStatus,
      amountUsd: record.amountUsd,
      payCurrency: record.payCurrency,
      payAmount: record.payAmount,
      invoiceUrl: paymentUrl,
      paymentUrl,
      canOpenInvoice,
      paidAt: record.paidAt,
      expiredAt: record.expiredAt,
      expiresAt: deadline,
      subscriptionPeriodEnd: record.subscriptionPeriodEnd,
      createdAt: record.createdAt,
      subscriptionStatus: record.Subscription?.status || null,
      hasAccess: record.Subscription?.status === 'active',
    }

    return createSuccessResponse(payload, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'get-payment-status', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to check status', 500, undefined, 'PAYMENT_STATUS_FAILED', requestId)
  }
}
