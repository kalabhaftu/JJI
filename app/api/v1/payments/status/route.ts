import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import { refreshPaymentRecordStatus } from '@/lib/services/subscription-service'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const paymentRecordId = request.nextUrl.searchParams.get('paymentRecordId')
    if (!paymentRecordId) {
      return NextResponse.json({ success: false, error: 'Missing paymentRecordId' }, { status: 400 })
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
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 })
    }

    const payload = {
      id: record.id,
      providerStatus: record.providerStatus,
      amountUsd: record.amountUsd,
      payCurrency: record.payCurrency,
      payAmount: record.payAmount,
      invoiceUrl: record.invoiceUrl,
      paidAt: record.paidAt,
      expiredAt: record.expiredAt,
      subscriptionPeriodEnd: record.subscriptionPeriodEnd,
      createdAt: record.createdAt,
      subscriptionStatus: record.Subscription?.status || null,
      hasAccess: record.Subscription?.status === 'active',
    }

    return NextResponse.json({ success: true, data: payload })
  } catch (error) {
    logger.error({ error, context: 'Payment Status' }, 'Payment status check failed')
    return NextResponse.json({ success: false, error: 'Failed to check status' }, { status: 500 })
  }
}