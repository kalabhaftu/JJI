import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { isJournalEmotion } from '@/lib/journal-emotions'
import { getDailyJournalEntry, normalizeJournalDate } from '@/server/daily-journal'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const accountId = searchParams.get('accountId')

    if (!date) {
      return createErrorResponse('Date is required', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    const journal = await getDailyJournalEntry(identity.internalUserId, date, accountId)

    return createSuccessResponse({ journal }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'get-daily-journal',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to fetch journal entry', 500, undefined, 'JOURNAL_READ_FAILED', requestId)
  }
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const internalUserId = identity.internalUserId
    const body = await request.json()
    const { date, note, emotion, accountId } = body

    if (!date || note === undefined) {
      return createErrorResponse('Date and note are required', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    if (emotion !== undefined && emotion !== null && !isJournalEmotion(emotion)) {
      return createErrorResponse('Invalid emotion value', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    let validAccountId: string | null = null
    if (accountId) {
      const userAccount = await db.query.Account.findFirst({
        where: (table, { eq, and }) => and(eq(table.id, accountId), eq(table.userId, internalUserId)),
      })
      validAccountId = userAccount ? accountId : null
    }

    const normalizedDate = normalizeJournalDate(date)
    const existing = await getDailyJournalEntry(internalUserId, normalizedDate, validAccountId)

    if (existing) {
      return createErrorResponse(
        'Journal entry already exists for this date',
        409,
        undefined,
        'CONFLICT',
        requestId,
      )
    }

    const journal = (await db.insert(schema.DailyNote).values({
      id: crypto.randomUUID(),
      updatedAt: new Date(),
      userId: internalUserId,
      date: normalizedDate,
      note: note || '',
      emotion: emotion || null,
      accountId: validAccountId,
    }).returning())[0]

    return createSuccessResponse({ journal }, undefined, undefined, requestId, { status: 201 })
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'create-daily-journal',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to create journal entry', 500, undefined, 'JOURNAL_CREATE_FAILED', requestId)
  }
}
