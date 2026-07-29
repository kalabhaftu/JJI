import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

export async function PATCH(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    const body = await request.json().catch(() => null)
    if (typeof body?.isFirstConnection !== 'boolean') {
      return createErrorResponse('isFirstConnection must be boolean', 400, undefined, 'VALIDATION_ERROR', requestId)
    }
    await db.transaction(async (tx) => {
      await tx.update(schema.User)
        .set({ isFirstConnection: body.isFirstConnection })
        .where(eq(schema.User.id, identity.internalUserId))
      await recordAuditEvent({
        userId: identity.internalUserId,
        action: 'ONBOARDING_STATUS_UPDATED',
        entityType: 'User',
        entityId: identity.internalUserId,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        afterData: { isFirstConnection: body.isFirstConnection },
      }, tx as never)
    })
    return createSuccessResponse(
      { isFirstConnection: body.isFirstConnection },
      undefined,
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'update-onboarding-status', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to update onboarding status', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
