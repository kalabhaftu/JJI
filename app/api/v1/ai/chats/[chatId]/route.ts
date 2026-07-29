import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { z } from 'zod'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

const updateChatSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'ai')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
  }
  const userId = identity.internalUserId

  const { chatId } = await params

  try {
    const chat = await db.query.AIChat.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, chatId), eq(table.userId, userId), eq(table.isDeleted, false)),
      with: {
        messages: {
          orderBy: (table, { asc }) => [asc(table.createdAt)],
        },
      },
    })

    if (!chat) {
      return createErrorResponse('Chat not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    return createSuccessResponse(chat, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'get-ai-chat', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to fetch chat', 500, undefined, 'AI_CHAT_READ_FAILED', requestId)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'ai')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
  }
  const userId = identity.internalUserId

  const { chatId } = await params

  try {
    const chat = await db.query.AIChat.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, chatId), eq(table.userId, userId), eq(table.isDeleted, false)),
    })

    if (!chat) {
      return createErrorResponse('Chat not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    const { title, isPinned, isArchived } = updateChatSchema.parse(await request.json())

    const updatedChat = (await db
      .update(schema.AIChat)
      .set({
        ...(title !== undefined && { title }),
        ...(isPinned !== undefined && { isPinned }),
        ...(isArchived !== undefined && { isArchived }),
      })
      .where(and(eq(schema.AIChat.id, chatId), eq(schema.AIChat.userId, userId)))
      .returning({
        id: schema.AIChat.id,
        title: schema.AIChat.title,
        isPinned: schema.AIChat.isPinned,
        isArchived: schema.AIChat.isArchived,
        createdAt: schema.AIChat.createdAt,
        updatedAt: schema.AIChat.updatedAt,
      }))[0]

    return createSuccessResponse(updatedChat, undefined, undefined, requestId)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid chat update', 400, error.flatten(), 'VALIDATION_ERROR', requestId)
    }
    reportError(error, { surface: 'api', operation: 'update-ai-chat', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to update chat', 500, undefined, 'AI_CHAT_UPDATE_FAILED', requestId)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'ai')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
  }
  const userId = identity.internalUserId

  const { chatId } = await params

  try {
    const chat = await db.query.AIChat.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, chatId), eq(table.userId, userId), eq(table.isDeleted, false)),
    })

    if (!chat) {
      return createErrorResponse('Chat not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    await db
      .update(schema.AIChat)
      .set({ isDeleted: true })
      .where(and(eq(schema.AIChat.id, chatId), eq(schema.AIChat.userId, userId)))

    return createSuccessResponse(
      { deleted: true },
      'Chat deleted successfully',
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'delete-ai-chat', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to delete chat', 500, undefined, 'AI_CHAT_DELETE_FAILED', requestId)
  }
}
