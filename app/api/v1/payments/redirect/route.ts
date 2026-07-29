import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import { refreshPaymentRecordStatus } from '@/lib/services/subscription-service'
import { logger } from '@/lib/logger'

const PENDING_PROVIDER_STATUSES = new Set(['pending', 'waiting', 'confirming', 'confirmed', 'sending', 'partially_paid'])

function statusRedirect(request: NextRequest) {
  return NextResponse.redirect(new URL('/subscribe/status', request.url))
}

export async function GET(request: NextRequest) {
  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.redirect(new URL('/login?next=/subscribe/status', request.url))
    }

    const paymentRecordId = request.nextUrl.searchParams.get('paymentRecordId')
    if (!paymentRecordId) {
      return statusRedirect(request)
    }

    await refreshPaymentRecordStatus(paymentRecordId, identity.internalUserId)

    const record = await db.query.PaymentRecord.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, paymentRecordId), eq(table.userId, identity.internalUserId)),
    })

    if (!record) {
      return statusRedirect(request)
    }

    const isPending = Boolean(record.providerStatus && PENDING_PROVIDER_STATUSES.has(record.providerStatus))
    const deadline = record.dueDate || (record.createdAt ? new Date(record.createdAt.getTime() + 30 * 60 * 1000) : null)
    const canOpenInvoice = Boolean(record.invoiceUrl && isPending && deadline && deadline > new Date())

    if (!canOpenInvoice) {
      return statusRedirect(request)
    }

    return NextResponse.redirect(record.invoiceUrl!)
  } catch (error) {
    logger.error({ error, context: 'Payment Redirect' }, 'Payment redirect failed')
    return statusRedirect(request)
  }
}
