import { and, eq } from 'drizzle-orm'

import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'

export interface WeeklyReviewInput {
  startDate: Date
  endDate: Date
  calendarImage?: string
  expectation?: any
  actualOutcome?: any
  isCorrect?: boolean
  notes?: string
}

function normalizeMonday(startDate: Date): Date {
  const date = new Date(startDate)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  return date
}

export async function getWeeklyReviewForUser(userId: string, startDate: Date) {
  const monday = normalizeMonday(startDate)
  return db.query.WeeklyReview.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.userId, userId),
      operators.eq(table.startDate, monday),
    ),
  })
}

export async function saveWeeklyReviewForUser(
  userId: string,
  data: WeeklyReviewInput,
  context: { requestId?: string; ipAddress?: string | null; source: 'api' | 'server-action' },
) {
  const monday = normalizeMonday(data.startDate)
  return db.transaction(async (tx) => {
    const existing = await tx.query.WeeklyReview.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.userId, userId),
        operators.eq(table.startDate, monday),
      ),
    })
    const values = {
      ...data,
      startDate: monday,
      endDate: new Date(data.endDate),
      updatedAt: new Date(),
    }
    const review = existing
      ? (await tx.update(schema.WeeklyReview)
          .set(values)
          .where(and(
            eq(schema.WeeklyReview.userId, userId),
            eq(schema.WeeklyReview.startDate, monday),
          ))
          .returning())[0]
      : (await tx.insert(schema.WeeklyReview)
          .values({ id: crypto.randomUUID(), userId, ...values })
          .returning())[0]
    if (!review) throw new Error('Failed to save review')

    await recordAuditEvent({
      userId,
      action: existing ? 'WEEKLY_REVIEW_UPDATED' : 'WEEKLY_REVIEW_CREATED',
      entityType: 'WeeklyReview',
      entityId: review.id,
      source: context.source,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      afterData: {
        weekStart: monday,
        hasCalendarImage: Boolean(data.calendarImage),
        hasNotes: Boolean(data.notes),
      },
    }, tx as never)
    return review
  })
}
