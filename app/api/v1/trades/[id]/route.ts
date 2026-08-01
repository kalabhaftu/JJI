import { NextRequest } from 'next/server'
import { z } from 'zod'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { db } from '@/lib/db/client'
import { Trade } from '@/lib/db/schema'
import { isDomainError } from '@/lib/domain-error'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { invalidateTradesCache } from '@/lib/cache/invalidate-trade'
import { getClientIp } from '@/lib/security/client-ip'
import { parseTradeUpdate } from '@/lib/trades/update-schema'
import { createSignedStorageUrl } from '@/server/storage-admin'
import {
  deleteTradeForUser,
  updateTradeForUser,
} from '@/server/trades/mutations'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function invalidateTradeCaches(
  userId: string,
  accountId: string | null,
  requestId: string,
) {
  try {
    await invalidateTradesCache(userId, accountId)
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'invalidate-trade-cache',
      userId,
      requestId,
    })
  }
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const { id } = await params
    const trade = await db.query.Trade.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.id, id),
        operators.eq(table.userId, identity.internalUserId),
      ),
      with: { executions: true },
    })
    if (!trade) {
      return createErrorResponse('Trade not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    const imageFields = [
      'imageOne',
      'imageTwo',
      'imageThree',
      'imageFour',
      'imageFive',
      'imageSix',
      'cardPreviewImage',
    ] as const
    for (const field of imageFields) {
      if (!trade[field]) continue
      const signedUrl = await createSignedStorageUrl(trade[field]!, 3600)
      if (signedUrl) (trade as any)[field] = signedUrl
    }
    return createSuccessResponse(trade, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'get-trade',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Internal Server Error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const { id } = await params
    const body = parseTradeUpdate(await request.json())
    const { existing, updated } = await updateTradeForUser(
      identity.internalUserId,
      id,
      body as Partial<typeof Trade.$inferInsert>,
      {
        requestId,
        ipAddress: getClientIp(request.headers),
      },
    )
    await invalidateTradeCaches(
      identity.internalUserId,
      existing.accountId,
      requestId,
    )
    return createSuccessResponse(updated, undefined, undefined, requestId)
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
    if (isDomainError(error)) {
      return createErrorResponse(error.message, error.status, undefined, error.code, requestId)
    }
    reportError(error, {
      surface: 'api',
      operation: 'update-trade',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Internal Server Error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const { id } = await params
    const existing = await deleteTradeForUser(identity.internalUserId, id, {
      requestId,
      ipAddress: getClientIp(request.headers),
    })
    await invalidateTradeCaches(
      identity.internalUserId,
      existing.accountId,
      requestId,
    )
    return createSuccessResponse(
      { deleted: true },
      'Trade deleted successfully',
      undefined,
      requestId,
    )
  } catch (error) {
    if (isDomainError(error)) {
      return createErrorResponse(error.message, error.status, undefined, error.code, requestId)
    }
    reportError(error, {
      surface: 'api',
      operation: 'delete-trade',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Internal Server Error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
