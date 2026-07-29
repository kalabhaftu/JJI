import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { isJournalEmotion } from '@/lib/journal-emotions'
import { and, eq } from 'drizzle-orm'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const internalUserId = identity.internalUserId
    const { id } = await params
    const body = await request.json()
    const { note, emotion } = body

    if (emotion !== undefined && emotion !== null && !isJournalEmotion(emotion)) {
      return createErrorResponse('Invalid emotion value', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    const existing = await db.query.DailyNote.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })
    if (!existing) {
      return createErrorResponse('Journal not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    const journal = (await db.update(schema.DailyNote).set({
      note: note !== undefined ? note : existing.note,
      emotion: emotion !== undefined ? emotion : existing.emotion,
    }).where(and(
      eq(schema.DailyNote.id, id),
      eq(schema.DailyNote.userId, internalUserId),
    )).returning())[0]

    return createSuccessResponse({ journal }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'update-daily-journal',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to update journal entry', 500, undefined, 'JOURNAL_UPDATE_FAILED', requestId)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const internalUserId = identity.internalUserId
    const { id } = await params

    const existing = await db.query.DailyNote.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })
    if (!existing) {
      return createErrorResponse('Journal not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    await db.delete(schema.DailyNote).where(and(
      eq(schema.DailyNote.id, id),
      eq(schema.DailyNote.userId, internalUserId),
    ))
    return createSuccessResponse({ deleted: true }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'delete-daily-journal',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to delete journal entry', 500, undefined, 'JOURNAL_DELETE_FAILED', requestId)
  }
}
