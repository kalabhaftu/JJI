import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ insightId: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'ai')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
  }
  const userId = identity.internalUserId

  const { insightId } = await params

  try {
    const insight = await db.query.AISavedInsight.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, insightId), eq(table.userId, userId)),
    })

    if (!insight) {
      return createErrorResponse('Insight not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    await db.delete(schema.AISavedInsight).where(and(
      eq(schema.AISavedInsight.id, insightId),
      eq(schema.AISavedInsight.userId, userId),
    ))

    return createSuccessResponse(
      { deleted: true },
      'Insight deleted successfully',
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'delete-ai-insight', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to delete insight', 500, undefined, 'AI_INSIGHT_DELETE_FAILED', requestId)
  }
}
