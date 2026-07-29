import { NextRequest } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { invalidateTradesCache } from '@/lib/cache/invalidate-trade'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import { parseTradeUpdate } from '@/lib/trades/update-schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

const requestSchema = z.object({
  tradeIds: z.array(z.string().min(1).max(128)).min(1).max(1_000),
  update: z.record(z.string(), z.unknown()),
}).strict()

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return createErrorResponse(
        'Validation failed',
        400,
        parsed.error.flatten(),
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const tradeIds = [...new Set(parsed.data.tradeIds)]
    let update: ReturnType<typeof parseTradeUpdate>
    try {
      update = parseTradeUpdate(parsed.data.update)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          'Invalid trade update',
          400,
          error.flatten(),
          'VALIDATION_ERROR',
          requestId,
        )
      }
      throw error
    }

    const existing = await db.query.Trade.findMany({
      where: (table, operators) => operators.and(
        operators.inArray(table.id, tradeIds),
        operators.eq(table.userId, identity.internalUserId),
      ),
      columns: { id: true, accountId: true },
    })
    if (existing.length !== tradeIds.length) {
      return createErrorResponse(
        'One or more trades were not found',
        404,
        undefined,
        'NOT_FOUND',
        requestId,
      )
    }

    const updated = await db.transaction(async (tx) => {
      const rows = await tx.update(schema.Trade)
        .set(update)
        .where(and(
          inArray(schema.Trade.id, tradeIds),
          eq(schema.Trade.userId, identity.internalUserId),
        ))
        .returning({ id: schema.Trade.id })
      await recordAuditEvent({
        userId: identity.internalUserId,
        action: 'TRADES_BULK_UPDATED',
        entityType: 'Trade',
        entityId: `bulk:${requestId}`,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        beforeData: { count: existing.length, ids: existing.map(({ id }) => id) },
        afterData: { count: rows.length, updatedFields: Object.keys(update) },
      }, tx as never)
      return rows
    })

    await invalidateTradesCache(identity.internalUserId)
    return createSuccessResponse(
      { updated: updated.length },
      undefined,
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'bulk-update-trades',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to update trades',
      500,
      undefined,
      'TRADE_UPDATE_FAILED',
      requestId,
    )
  }
}
