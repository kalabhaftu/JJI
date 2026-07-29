import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { CacheHeaders } from '@/lib/api-cache-headers'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

// GET - Fetch all tags for a user
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'authenticated-read')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const userId = identity.internalUserId

    const tags = await db.query.TradeTag.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
      orderBy: (table, { asc }) => [asc(table.name)]
    })

    return createSuccessResponse(tags, undefined, undefined, requestId, {
      headers: CacheHeaders.short,
    })
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'list-tags',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to fetch tags',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}

// POST - Create a new tag
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const userId = identity.internalUserId

    const body = await request.json()
    const { name, color } = body

    if (!name) {
      return createErrorResponse('Tag name is required', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    const existingTag = await db.query.TradeTag.findFirst({
      where: (table, { and, eq }) => and(
        eq(table.name, name),
        eq(table.userId, userId)
      )
    })

    if (existingTag) {
      return createErrorResponse('Tag with this name already exists', 409, undefined, 'CONFLICT', requestId)
    }

    const tag = (await db.insert(schema.TradeTag).values({
      id: crypto.randomUUID(),
      updatedAt: new Date(),
      name,
      color: color || '#3b82f6',
      userId
    }).returning())[0]

    return createSuccessResponse(tag, undefined, undefined, requestId, { status: 201 })
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'create-tag',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to create tag',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}
