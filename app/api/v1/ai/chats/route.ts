import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { checkAIAccess } from '@/lib/services/ai-guard-service'
import { hasCurrentAiDataConsent } from '@/lib/services/ai-consent'
import { z } from 'zod'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

const createChatSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  accounts: z.array(z.string().min(1).max(256)).max(100).default([]),
  dateRange: z.enum(['all-time', 'last-7-days', 'last-30-days', 'last-90-days', 'custom']).default('last-30-days'),
  customFrom: z.string().datetime().or(z.string().date()).nullable().optional(),
  customTo: z.string().datetime().or(z.string().date()).nullable().optional(),
  dataSources: z.array(z.enum(['trades', 'journals', 'performance', 'statistics', 'reviews'])).max(5).default([]),
}).strict()

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'ai')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
  }
  const userId = identity.internalUserId

  try {
    // Check general AI access
    const aiGuard = await checkAIAccess(userId)
    if (!aiGuard.hasAccess) {
      return createErrorResponse(aiGuard.reason, 403, undefined, 'PAYWALL', requestId)
    }

    const chats = await db.query.AIChat.findMany({
      where: (table, { eq, and }) => and(eq(table.userId, userId), eq(table.isDeleted, false)),
      orderBy: (table, { desc }) => [desc(table.isPinned), desc(table.updatedAt)],
      columns: {
        id: true,
        title: true,
        isPinned: true,
        isArchived: true,
        accounts: true,
        dateRange: true,
        customFrom: true,
        customTo: true,
        dataSources: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return createSuccessResponse(chats, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'list-ai-chats', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to fetch chats', 500, undefined, 'AI_CHATS_READ_FAILED', requestId)
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
    // Check AI access
    const aiGuard = await checkAIAccess(userId)
    if (!aiGuard.hasAccess) {
      return createErrorResponse(aiGuard.reason, 403, undefined, 'PAYWALL', requestId)
    }

    if (!(await hasCurrentAiDataConsent(userId))) {
      return createErrorResponse(
        'AI data processing consent is required',
        412,
        undefined,
        'AI_DATA_CONSENT_REQUIRED',
        requestId,
      )
    }

    const { title, accounts, dateRange, customFrom, customTo, dataSources } = createChatSchema.parse(await request.json())

    const chat = (await db.insert(schema.AIChat).values({
      userId,
      title: title || 'New Conversation',
      accounts: accounts || [],
      dateRange: dateRange || 'last-30-days',
      customFrom: customFrom ? new Date(customFrom) : null,
      customTo: customTo ? new Date(customTo) : null,
      dataSources: dataSources || [],
    }).returning())[0]

    return createSuccessResponse(chat, undefined, undefined, requestId, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid chat configuration', 400, error.flatten(), 'VALIDATION_ERROR', requestId)
    }
    reportError(error, { surface: 'api', operation: 'create-ai-chat', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to create chat', 500, undefined, 'AI_CHAT_CREATE_FAILED', requestId)
  }
}
