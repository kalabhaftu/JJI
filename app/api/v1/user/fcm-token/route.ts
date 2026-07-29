import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { recordAuditEvent } from '@/lib/audit-logger'
import { getClientIp } from '@/lib/security/client-ip'

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const internalUserId = identity.internalUserId
    const { token } = await request.json()

    if (typeof token !== 'string' || !token.trim() || token.length > 4_096) {
      return createErrorResponse('Valid token is required', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    await db.transaction(async (tx) => {
      await tx.update(schema.User)
        .set({ fcmToken: token.trim() })
        .where(eq(schema.User.id, internalUserId))
      await recordAuditEvent({
        userId: internalUserId,
        action: 'PUSH_TOKEN_UPDATED',
        entityType: 'User',
        entityId: internalUserId,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        afterData: { pushNotificationsConfigured: true },
      }, tx as never)
    })

    return createSuccessResponse(
      { configured: true },
      'FCM token updated successfully',
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'update-fcm-token',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to update FCM token',
      500,
      undefined,
      'FCM_TOKEN_UPDATE_FAILED',
      requestId,
    )
  }
}
