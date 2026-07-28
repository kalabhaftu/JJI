'use server'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getInternalUserId } from '@/server/user-identity'
import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'

export async function getWeeklyReview(startDate: Date) {
  const userId = await getInternalUserId()
  if (!userId) return null

  try {
    const date = new Date(startDate)
    date.setHours(0, 0, 0, 0)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date.setDate(diff))
    
    const review = await db.query.WeeklyReview.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.userId, userId),
        eq(table.startDate, monday)
      )
    })
    
    return review
  } catch (error) {
    return null
  }
}

export async function saveWeeklyReview(data: {
  startDate: Date
  endDate: Date
  calendarImage?: string
  expectation?: any
  actualOutcome?: any
  isCorrect?: boolean
  notes?: string
}) {
  const userId = await getInternalUserId()
  if (!userId) throw new Error('Unauthorized')

  try {
    const date = new Date(data.startDate)
    date.setHours(0, 0, 0, 0)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date.setDate(diff))
    
    const existing = await db.query.WeeklyReview.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.userId, userId),
        eq(table.startDate, monday)
      )
    })

    let review
    if (existing) {
      review = (await db.update(schema.WeeklyReview)
        .set({ ...data, startDate: monday })
        .where(and(eq(schema.WeeklyReview.userId, userId), eq(schema.WeeklyReview.startDate, monday)))
        .returning())[0]
    } else {
      review = (await db.insert(schema.WeeklyReview)
        .values({ id: randomUUID(), userId, ...data, startDate: monday, updatedAt: new Date() })
        .returning())[0]
    }
    
    return { success: true, data: review }
  } catch (error) {
    return { success: false, error: 'Failed to save review' }
  }
}
