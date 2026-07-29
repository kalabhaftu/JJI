import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { and, inArray, eq } from 'drizzle-orm'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { resolveRequestId } from '@/lib/observability/request-id'
import { reportError } from '@/lib/observability/report-error'
import { recordAuditEvent } from '@/lib/audit-logger'
import { getClientIp } from '@/lib/security/client-ip'
import { invalidateTradesCache } from '@/lib/cache/invalidate-trade'

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rl = await applyApiRoutePolicy(request, 'sensitive')
  if (rl) return rl

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const body = await request.json()
    const { tradeIds } = body as { tradeIds: string[] }

    if (!Array.isArray(tradeIds) || tradeIds.length < 2) {
      return createErrorResponse('tradeIds must contain at least 2 ids', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    const groupId = crypto.randomUUID()

    const uniqueIds = [...new Set(tradeIds)].slice(0, 1_000)
    const result = await db.transaction(async (tx) => {
      const rows = await tx.update(schema.Trade)
        .set({ groupId })
        .where(and(
          inArray(schema.Trade.id, uniqueIds),
          eq(schema.Trade.userId, identity.internalUserId),
        ))
        .returning({ id: schema.Trade.id })
      if (rows.length !== uniqueIds.length) {
        throw new Error('One or more trades are not owned by the current user')
      }
      await recordAuditEvent({
        userId: identity.internalUserId,
        action: 'TRADES_GROUPED',
        entityType: 'Trade',
        entityId: groupId,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        afterData: { count: rows.length },
      }, tx as never)
      return rows
    })
    await invalidateTradesCache(identity.internalUserId)

    return createSuccessResponse({ groupId, updated: result.length }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'group-trades', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Internal server error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
