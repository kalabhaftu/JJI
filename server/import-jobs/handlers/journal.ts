import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import type { ImportPreparationHandler } from '@/server/import-jobs/preparation-types'

export const prepareJournalTemplates: ImportPreparationHandler = async (
  data,
  internalUserId,
) => {
  for (const template of data.journalTemplates ?? []) {
    if (!template?.name) continue
    const existing = await db.query.JournalTemplate.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.userId, internalUserId),
        operators.eq(table.name, template.name),
      ),
    })
    if (existing) {
      await db.update(schema.JournalTemplate)
        .set({ content: template.content })
        .where(and(
          eq(schema.JournalTemplate.userId, internalUserId),
          eq(schema.JournalTemplate.name, template.name),
        ))
    } else {
      await db.insert(schema.JournalTemplate).values({
        id: crypto.randomUUID(),
        userId: internalUserId,
        name: template.name,
        content: template.content,
        updatedAt: new Date(),
      })
    }
  }
}

export const prepareWeeklyAIReviews: ImportPreparationHandler = async (
  data,
  internalUserId,
) => {
  for (const review of data.weeklyAIReviews ?? []) {
    if (!review?.weekStart) continue
    const weekStart = new Date(review.weekStart)
    const existing = await db.query.WeeklyAIReview.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.userId, internalUserId),
        operators.eq(table.weekStart, weekStart),
      ),
    })
    const values = {
      weekEnd: review.weekEnd ? new Date(review.weekEnd) : weekStart,
      stats: review.stats,
      summary: review.summary,
      highlights: review.highlights ?? [],
      lowlights: review.lowlights ?? [],
      focusNextWeek: review.focusNextWeek,
      grade: review.grade,
    }
    if (existing) {
      await db.update(schema.WeeklyAIReview)
        .set(values)
        .where(and(
          eq(schema.WeeklyAIReview.userId, internalUserId),
          eq(schema.WeeklyAIReview.weekStart, weekStart),
        ))
    } else {
      await db.insert(schema.WeeklyAIReview).values({
        id: crypto.randomUUID(),
        userId: internalUserId,
        weekStart,
        ...values,
      })
    }
  }
}

export const prepareUserGoals: ImportPreparationHandler = async (
  data,
  internalUserId,
) => {
  for (const goal of data.userGoals ?? []) {
    if (!goal?.title) continue
    const existing = await db.query.UserGoal.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.userId, internalUserId),
        operators.eq(table.title, goal.title),
        operators.eq(table.metric, goal.metric),
        operators.eq(table.period, goal.period),
        goal.startDate
          ? operators.eq(table.startDate, new Date(goal.startDate))
          : undefined,
      ),
    })
    if (existing) continue

    await db.insert(schema.UserGoal).values({
      id: crypto.randomUUID(),
      userId: internalUserId,
      title: goal.title,
      metric: goal.metric,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue ?? 0,
      period: goal.period,
      startDate: goal.startDate ? new Date(goal.startDate) : new Date(),
      endDate: goal.endDate ? new Date(goal.endDate) : null,
      isCompleted: Boolean(goal.isCompleted),
      completedAt: goal.completedAt ? new Date(goal.completedAt) : null,
      updatedAt: new Date(),
    })
  }
}

export const prepareNotifications: ImportPreparationHandler = async (
  data,
  internalUserId,
) => {
  for (const notification of data.notifications ?? []) {
    if (!notification?.title || !notification?.createdAt) continue
    const createdAt = new Date(notification.createdAt)
    const existing = await db.query.Notification.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.userId, internalUserId),
        operators.eq(table.title, notification.title),
        operators.eq(table.type, notification.type),
        operators.eq(table.createdAt, createdAt),
      ),
    })
    if (existing) continue

    await db.insert(schema.Notification).values({
      id: crypto.randomUUID(),
      userId: internalUserId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      isRead: Boolean(notification.isRead),
      actionRequired: Boolean(notification.actionRequired),
      invalidationKey: notification.invalidationKey,
      data: notification.data,
      createdAt,
      updatedAt: new Date(),
    })
  }
}
