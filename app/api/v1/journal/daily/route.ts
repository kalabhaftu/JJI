import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { isJournalEmotion } from '@/lib/journal-emotions'
import { getDailyJournalEntry, normalizeJournalDate } from '@/server/daily-journal'

export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const accountId = searchParams.get('accountId')

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const journal = await getDailyJournalEntry(internalUserId, date, accountId)

    return NextResponse.json({ journal })
  } catch (error: any) {
    logger.error({ error: error?.message, context: 'api' }, 'GET /api/v1/journal/daily')
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch journal entry' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const body = await request.json()
    const { date, note, emotion, accountId } = body

    if (!date || note === undefined) {
      return NextResponse.json({ error: 'Date and note are required' }, { status: 400 })
    }

    if (emotion !== undefined && emotion !== null && !isJournalEmotion(emotion)) {
      return NextResponse.json({ error: 'Invalid emotion value' }, { status: 400 })
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
      return NextResponse.json({ error: 'Journal entry already exists for this date' }, { status: 409 })
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

    return NextResponse.json({ journal }, { status: 201 })
  } catch (error: any) {
    logger.error({ error: error?.message, context: 'api' }, 'POST /api/v1/journal/daily')
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 })
  }
}