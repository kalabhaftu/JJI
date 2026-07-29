import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { inArray, eq, and } from 'drizzle-orm'
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
    const { tradeIds, tags, mode } = body as {
      tradeIds: string[]
      tags: string[]
      mode?: 'append' | 'replace'
    }

    if (!Array.isArray(tradeIds) || tradeIds.length === 0) {
      return createErrorResponse('tradeIds must be a non-empty array', 400, undefined, 'VALIDATION_ERROR', requestId)
    }
    if (!Array.isArray(tags) || tags.length === 0) {
      return createErrorResponse('tags must be a non-empty array', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    const uniqueIds = [...new Set(tradeIds)].slice(0, 1_000)
    const existing = await db.query.Trade.findMany({
      where: (table, operators) => operators.and(
        operators.inArray(table.id, uniqueIds),
        operators.eq(table.userId, identity.internalUserId),
      ),
      columns: { id: true, tags: true },
    })
    if (existing.length !== uniqueIds.length) {
      return createErrorResponse('One or more trades were not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    const result = await db.transaction(async (tx) => {
      if (mode === 'append') {
        const rows = []
        for (const trade of existing) {
          const nextTags = [...new Set([...(trade.tags ?? []), ...tags])]
          const [updated] = await tx.update(schema.Trade)
            .set({ tags: nextTags })
            .where(and(
              eq(schema.Trade.id, trade.id),
              eq(schema.Trade.userId, identity.internalUserId),
            ))
            .returning({ id: schema.Trade.id })
          if (updated) rows.push(updated)
        }
        await recordAuditEvent({
          userId: identity.internalUserId,
          action: 'TRADE_TAGS_APPENDED',
          entityType: 'Trade',
          entityId: `bulk:${requestId}`,
          source: 'api',
          requestId,
          ipAddress: getClientIp(request.headers),
          afterData: { count: rows.length, tagCount: tags.length },
        }, tx as never)
        return rows
      }

      const rows = await tx.update(schema.Trade)
        .set({ tags: [...new Set(tags)] })
        .where(and(
          inArray(schema.Trade.id, uniqueIds),
          eq(schema.Trade.userId, identity.internalUserId),
        ))
        .returning({ id: schema.Trade.id })
      await recordAuditEvent({
        userId: identity.internalUserId,
        action: 'TRADE_TAGS_REPLACED',
        entityType: 'Trade',
        entityId: `bulk:${requestId}`,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        afterData: { count: rows.length, tagCount: tags.length },
      }, tx as never)
      return rows
    })

    await invalidateTradesCache(identity.internalUserId)
    return createSuccessResponse({ updated: result.length }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'batch-tag-trades',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Internal server error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
