import { randomBytes } from 'crypto'
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

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    const token = randomBytes(32).toString('hex')
    await db.transaction(async (tx) => {
      await tx.update(schema.User)
        .set({ thorToken: token })
        .where(eq(schema.User.id, identity.internalUserId))
      await recordAuditEvent({
        userId: identity.internalUserId,
        action: 'THOR_TOKEN_ROTATED',
        entityType: 'UserIntegration',
        entityId: identity.internalUserId,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        afterData: { integration: 'thor' },
      }, tx as never)
    })
    return createSuccessResponse({ token }, 'Token generated', undefined, requestId)
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'generate-thor-token', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to generate token', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
