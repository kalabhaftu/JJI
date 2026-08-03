import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { eq, and, sql } from 'drizzle-orm'


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const userId = identity.internalUserId

    const { id } = await params
    const body = await request.json()
    const { name, color } = body


    const existingTag = await db.query.TradeTag.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, userId))
    })

    if (!existingTag) {
      return createErrorResponse('Tag not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    if (name && name !== existingTag.name) {
      const nameConflict = await db.query.TradeTag.findFirst({
        where: (table, { eq, and }) => and(eq(table.name, name), eq(table.userId, userId))
      })

      if (nameConflict) {
        return createErrorResponse('Tag with this name already exists', 409, undefined, 'CONFLICT', requestId)
      }
    }

    const updatedTag = (await db.update(schema.TradeTag).set({
      ...(name && { name }),
      ...(color && { color })
    }).where(and(
      eq(schema.TradeTag.id, id),
      eq(schema.TradeTag.userId, userId),
    )).returning())[0]

    return createSuccessResponse(updatedTag, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'update-tag',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to update tag',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const userId = identity.internalUserId

    const { id } = await params


    const existingTag = await db.query.TradeTag.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, userId))
    })

    if (!existingTag) {
      return createErrorResponse('Tag not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    await db.transaction(async (tx) => {
      await tx.update(schema.Trade)
        .set({ tags: sql`array_remove(${schema.Trade.tags}, ${id})` })
        .where(and(
          eq(schema.Trade.userId, userId),
          sql`${id} = any(${schema.Trade.tags})`,
        ))
      await tx.delete(schema.TradeTag).where(and(
        eq(schema.TradeTag.id, id),
        eq(schema.TradeTag.userId, userId),
      ))
    })

    return createSuccessResponse({ deleted: true }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'delete-tag',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to delete tag',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}
