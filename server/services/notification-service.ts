import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { NotificationType } from '@/lib/db/schema'

import { revalidateTag } from 'next/cache'

export type NotificationData = {
    type: NotificationType
    title: string
    message: string
    userId: string
    data?: Record<string, any>
    actionRequired?: boolean
    referenceId?: string
    invalidationKey?: string
}

export class NotificationService {
    static async send(payload: NotificationData) {
        const { userId, type, title, message, data, actionRequired, referenceId, invalidationKey } = payload

        if (invalidationKey) {
            const existing = await db.query.Notification.findFirst({
                where: (table, { eq, and }) => and(
                    eq(table.userId, userId),
                    eq(table.isRead, false),
                    eq(table.invalidationKey, invalidationKey)
                )
            })

            if (existing) {
                const updated = await db.update(schema.Notification).set({
                    title,
                    message,
                    type,
                    actionRequired: actionRequired ?? existing.actionRequired,
                    invalidationKey,
                    updatedAt: new Date(),
                    data: { ...(existing.data as object || {}), ...data, referenceId },
                }).where(eq(schema.Notification.id, existing.id)).returning().then(r => r[0]);
                revalidateTag(`notifications-${userId}`, 'max')
                return updated
            }
        }

        const notification = await db.insert(schema.Notification).values({
            userId,
            type,
            title,
            message,
            actionRequired: actionRequired ?? false,
            invalidationKey,
            updatedAt: new Date(),
            data: { ...data, referenceId }
        }).returning().then(r => r[0]);

        revalidateTag(`notifications-${userId}`, 'max')
        return notification
    }

    static async bulkInvalidate(userId: string, type: NotificationType) {
        await db.update(schema.Notification).set({ isRead: true, updatedAt: new Date() }).where(and(
            eq(schema.Notification.userId, userId),
            eq(schema.Notification.type, type),
            eq(schema.Notification.isRead, false)
        ));
        revalidateTag(`notifications-${userId}`, 'max')
    }
}
