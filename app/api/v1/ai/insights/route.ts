import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { z } from 'zod'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

const createInsightSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(50_000),
  category: z.string().trim().min(1).max(64).default('insight'),
}).strict()

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
  }
  const userId = identity.internalUserId

  try {
    const insights = await db.query.AISavedInsight.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    })

    return createSuccessResponse(insights, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'list-ai-insights', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to fetch insights', 500, undefined, 'AI_INSIGHTS_READ_FAILED', requestId)
  }
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'ai')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
  }
  const userId = identity.internalUserId

  try {
    const { title, content, category } = createInsightSchema.parse(await request.json())

    const insight = (await db.insert(schema.AISavedInsight).values({
      userId,
      title,
      content,
      category: category || 'insight',
    }).returning())[0]

    return createSuccessResponse(insight, undefined, undefined, requestId, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid insight', 400, error.flatten(), 'VALIDATION_ERROR', requestId)
    }
    reportError(error, { surface: 'api', operation: 'save-ai-insight', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to save insight', 500, undefined, 'AI_INSIGHT_SAVE_FAILED', requestId)
  }
}
