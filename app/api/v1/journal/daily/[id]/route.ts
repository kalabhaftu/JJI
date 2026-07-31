import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { isJournalEmotion } from '@/lib/journal-emotions'
import { and, eq } from 'drizzle-orm'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { id } = await params
    const body = await request.json()
    const { note, emotion } = body

    if (emotion !== undefined && emotion !== null && !isJournalEmotion(emotion)) {
      return NextResponse.json({ error: 'Invalid emotion value' }, { status: 400 })
    }

    const existing = await db.query.DailyNote.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })
    if (!existing) return NextResponse.json({ error: 'Journal not found' }, { status: 404 })

    const journal = (await db.update(schema.DailyNote).set({
      note: note !== undefined ? note : existing.note,
      emotion: emotion !== undefined ? emotion : existing.emotion,
    }).where(and(
      eq(schema.DailyNote.id, id),
      eq(schema.DailyNote.userId, internalUserId),
    )).returning())[0]

    return NextResponse.json({ journal })
  } catch (error: any) {
    logger.error({ error: error?.message, context: 'api' }, 'PUT /api/v1/journal/daily/[id]')
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to update journal entry' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { id } = await params

    const existing = await db.query.DailyNote.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })
    if (!existing) return NextResponse.json({ error: 'Journal not found' }, { status: 404 })

    await db.delete(schema.DailyNote).where(and(
      eq(schema.DailyNote.id, id),
      eq(schema.DailyNote.userId, internalUserId),
    ))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error({ error: error?.message, context: 'api' }, 'DELETE /api/v1/journal/daily/[id]')
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 })
  }
}
