import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { and, inArray, eq } from 'drizzle-orm'
import { invalidateTradesCache } from '@/lib/cache/invalidate-trade'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { resolveRequestId } from '@/lib/observability/request-id'
import { reportError } from '@/lib/observability/report-error'
import { recordAuditEvent } from '@/lib/audit-logger'
import { getClientIp } from '@/lib/security/client-ip'
import { deletePublicStorageUrls } from '@/server/storage-admin'

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

    if (!Array.isArray(tradeIds) || tradeIds.length === 0) {
      return createErrorResponse(
        'tradeIds must be a non-empty array',
        400,
        undefined,
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const uniqueIds = [...new Set(tradeIds)].slice(0, 1_000)
    const ownedTrades = await db.query.Trade.findMany({
      where: (table, operators) => operators.and(
        operators.inArray(table.id, uniqueIds),
        operators.eq(table.userId, identity.internalUserId),
      ),
      columns: {
        id: true,
        accountId: true,
        imageOne: true,
        imageTwo: true,
        imageThree: true,
        imageFour: true,
        imageFive: true,
        imageSix: true,
        cardPreviewImage: true,
      },
    })

    const deletedRows = await db.transaction(async (tx) => {
      const deleted = await tx.delete(schema.Trade).where(and(
          inArray(schema.Trade.id, uniqueIds),
          eq(schema.Trade.userId, identity.internalUserId),
        )).returning({ id: schema.Trade.id })
      await recordAuditEvent({
        userId: identity.internalUserId,
        action: 'TRADES_BULK_DELETED',
        entityType: 'Trade',
        entityId: `bulk:${requestId}`,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        beforeData: { count: deleted.length, ids: deleted.map(({ id }) => id) },
        afterData: null,
      }, tx as never)
      return deleted
    })

    await invalidateTradesCache(identity.internalUserId)

    const imageUrls = ownedTrades.flatMap((trade) => [
      trade.imageOne,
      trade.imageTwo,
      trade.imageThree,
      trade.imageFour,
      trade.imageFive,
      trade.imageSix,
      trade.cardPreviewImage,
    ]).filter((url): url is string => Boolean(url))
    if (imageUrls.length > 0) {
      try {
        await deletePublicStorageUrls(imageUrls)
      } catch (error) {
        reportError(error, {
          surface: 'api',
          operation: 'delete-trade-images-after-bulk-delete',
          route: request.nextUrl.pathname,
          requestId,
        })
      }
    }

    return createSuccessResponse(
      { deleted: deletedRows.length },
      undefined,
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'bulk-delete-trades',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Internal server error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
