import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { randomUUID } from 'crypto'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { recordAuditEvent } from '@/lib/audit-logger'
import { getClientIp } from '@/lib/security/client-ip'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const requestId = resolveRequestId(req.headers)
  const limited = await applyApiRoutePolicy(req, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const settings = await db.query.UserSettings.findFirst({
      where: (table, { eq }) => eq(table.userId, identity.internalUserId),
    })

    const token = settings?.webhookToken ?? null
    return createSuccessResponse({
      hasToken: Boolean(token),
      token,
    }, undefined, undefined, requestId)
  } catch (err) {
    reportError(err, { surface: 'api', operation: 'get-webhook-token', route: req.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to fetch webhook token', 500, undefined, 'WEBHOOK_TOKEN_READ_FAILED', requestId)
  }
}

export async function POST(req: NextRequest) {
  const requestId = resolveRequestId(req.headers)
  const limited = await applyApiRoutePolicy(req, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const internalUserId = identity.internalUserId
    const token = randomUUID()

    await db.transaction(async (tx) => {
      await tx
        .insert(schema.UserSettings)
        .values({ userId: internalUserId, webhookToken: token })
        .onConflictDoUpdate({
          target: schema.UserSettings.userId,
          set: { webhookToken: token },
        })
      await recordAuditEvent({
        userId: internalUserId,
        action: 'WEBHOOK_TOKEN_ROTATED',
        entityType: 'UserSettings',
        entityId: internalUserId,
        source: 'api',
        requestId,
        ipAddress: getClientIp(req.headers),
        afterData: { webhookConfigured: true },
      }, tx as never)
    })

    return createSuccessResponse({ token }, undefined, undefined, requestId)
  } catch (err) {
    reportError(err, { surface: 'api', operation: 'rotate-webhook-token', route: req.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to regenerate webhook token', 500, undefined, 'WEBHOOK_TOKEN_ROTATE_FAILED', requestId)
  }
}
