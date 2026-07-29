import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { invalidateUserAccountCaches } from '@/server/accounts/cache'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { recordAuditEvent } from '@/lib/audit-logger'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import { DomainError, isDomainError } from '@/lib/domain-error'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const { id: accountId } = await params
    const internalUserId = identity.internalUserId
    const { newDate, isPropFirm, notificationId } = await request.json()

    if (!newDate) {
      return createErrorResponse('New date is required', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    const adjustedDate = new Date(newDate)
    if (isNaN(adjustedDate.getTime())) {
      return createErrorResponse('Invalid date format', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    await db.transaction(async (tx) => {
      const updated = isPropFirm
        ? await tx.update(schema.MasterAccount)
          .set({ createdAt: adjustedDate })
          .where(and(
            eq(schema.MasterAccount.id, accountId),
            eq(schema.MasterAccount.userId, internalUserId),
          ))
          .returning({ id: schema.MasterAccount.id })
        : await tx.update(schema.Account)
          .set({ createdAt: adjustedDate })
          .where(and(
            eq(schema.Account.id, accountId),
            eq(schema.Account.userId, internalUserId),
          ))
          .returning({ id: schema.Account.id })
      if (updated.length === 0) {
        throw new DomainError('Account not found', 'NOT_FOUND', 404)
      }

      if (notificationId) {
        await tx.update(schema.Notification)
          .set({ isRead: true })
          .where(and(
            eq(schema.Notification.id, notificationId),
            eq(schema.Notification.userId, internalUserId),
          ))
      }
      await recordAuditEvent({
        userId: internalUserId,
        action: 'ACCOUNT_DATE_ADJUSTED',
        entityType: isPropFirm ? 'MasterAccount' : 'Account',
        entityId: accountId,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        afterData: { createdAt: adjustedDate.toISOString() },
      }, tx as never)
    })

    await invalidateUserAccountCaches(internalUserId, requestId)

    return createSuccessResponse(
      { adjusted: true },
      'Account creation date adjusted successfully',
      undefined,
      requestId,
    )
  } catch (error) {
    if (isDomainError(error)) {
      return createErrorResponse(
        error.message,
        error.status,
        undefined,
        error.code,
        requestId,
      )
    }
    reportError(error, {
      surface: 'api',
      operation: 'adjust-account-date',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to adjust account date',
      500,
      undefined,
      'ACCOUNT_DATE_ADJUST_FAILED',
      requestId,
    )
  }
}
