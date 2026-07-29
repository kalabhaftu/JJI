'use server'

import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import * as schema from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { escapeHtml, sendEmail } from '@/lib/email'

type NotificationType = 'FUNDED_PENDING_APPROVAL' | 'FUNDED_APPROVED' | 'FUNDED_DECLINED' | 'PHASE_TRANSITION_PENDING' | 'PAYOUT_APPROVED' | 'PAYOUT_REJECTED' | 'SYSTEM' | 'RISK_ALERT' | 'IMPORT_STATUS' | 'WEEKLY_PERFORMANCE' | 'STRATEGY_DEVIATION' | 'SYSTEM_ANNOUNCEMENT' | 'TRADE_STATUS' | 'RISK_DAILY_LOSS_80' | 'RISK_DAILY_LOSS_95' | 'RISK_MAX_DRAWDOWN_80' | 'RISK_MAX_DRAWDOWN_95' | 'RISK_BREACH' | 'IMPORT_PROCESSING' | 'IMPORT_COMPLETE' | 'STRATEGY_SESSION_VIOLATION' | 'FEEDBACK_REPLY' | 'PAYMENT_DUE_SOON' | 'PAYMENT_DUE_TODAY' | 'PAYMENT_OVERDUE' | 'SUBSCRIPTION_EXPIRED' | 'PAYMENT_RECEIVED' | 'PAYMENT_FAILED' | 'ACCESS_RESTORED' | 'ADMIN_FREE_ACCESS_GRANTED' | 'ADMIN_FREE_ACCESS_REVOKED';

type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const NotificationType = {
  RISK_BREACH: 'RISK_BREACH' as NotificationType,
  RISK_DAILY_LOSS_95: 'RISK_DAILY_LOSS_95' as NotificationType,
  RISK_DAILY_LOSS_80: 'RISK_DAILY_LOSS_80' as NotificationType,
  RISK_MAX_DRAWDOWN_95: 'RISK_MAX_DRAWDOWN_95' as NotificationType,
  RISK_MAX_DRAWDOWN_80: 'RISK_MAX_DRAWDOWN_80' as NotificationType,
  IMPORT_PROCESSING: 'IMPORT_PROCESSING' as NotificationType,
  IMPORT_COMPLETE: 'IMPORT_COMPLETE' as NotificationType,
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT' as NotificationType,
}

const NotificationPriority = {
  LOW: 'LOW' as NotificationPriority,
  MEDIUM: 'MEDIUM' as NotificationPriority,
  HIGH: 'HIGH' as NotificationPriority,
  CRITICAL: 'CRITICAL' as NotificationPriority,
}
export interface NotificationPayload {
    type: NotificationType
    title: string
    message: string
    data?: Record<string, any>
    actionRequired?: boolean
    priority?: NotificationPriority
    invalidationKey?: string
}

/**
 * NotificationService - Intelligent notification system with smart invalidation
 * 
 * Core Feature: Updates existing unread notifications instead of creating spam
 * 
 * Use Cases:
 * - Risk alerts that escalate (65% → 80% → 95%)
 * - Import lifecycle (Processing → Complete)
 * - Strategy deviations grouped by day
 */

/**
 * Create or update notification with smart invalidation
 * 
 * Logic:
 * 1. If invalidationKey provided:
 *    - Check for existing UNREAD notification with same key
 *    - If found: UPDATE existing notification (prevents spam)
 *    - If not found OR existing is READ: CREATE new notification
 * 2. If no invalidationKey: CREATE new notification
 */
export async function createOrUpdateNotification(userId: string, notification: NotificationPayload) {
    try {
        if (notification.invalidationKey) {
            // Try to find existing unread notification with same invalidation key
            const existing = await db.query.Notification.findFirst({
                where: and(
                    eq(schema.Notification.userId, userId),
                    eq(schema.Notification.invalidationKey, notification.invalidationKey),
                    eq(schema.Notification.isRead, false)
                )
            })

            if (existing) {
                // UPDATE existing unread notification
                const [updated] = await db.update(schema.Notification)
                    .set({
                        type: notification.type,
                        title: notification.title,
                        message: notification.message,
                        data: notification.data,
                        priority: notification.priority || NotificationPriority.MEDIUM,
                        actionRequired: notification.actionRequired ?? false,
                        updatedAt: new Date() // Bump to top of notification list
                    })
                    .where(eq(schema.Notification.id, existing.id))
                    .returning()

                revalidateTag(`notifications-${userId}`)
                return { success: true, data: updated, action: 'updated' as const }
            }
        }

        // CREATE new notification (either no invalidation key or existing was already read)
        const [created] = await db.insert(schema.Notification).values({
            userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            invalidationKey: notification.invalidationKey,
            priority: notification.priority || NotificationPriority.MEDIUM,
            actionRequired: notification.actionRequired ?? false,
            updatedAt: new Date()
        }).returning()

        revalidateTag(`notifications-${userId}`)
        return { success: true, data: created, action: 'created' as const }

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create notification'
        }
    }
}

/**
 * Risk Alert: Daily Loss Limit or Max Drawdown
 * Smart invalidation: Updates same notification as percentage increases
 * 
 * Example: Daily loss 65% → 80% → 95% (updates same notification)
 */
export async function createRiskAlert(
    userId: string,
    phaseAccountId: string,
    riskType: 'daily_loss' | 'max_drawdown',
    currentPercentage: number,
    metadata: {
        accountName: string
        currentBalance: number
        limit: number
        used: number
    }
) {
    // Determine severity level
    let type: NotificationType
    let priority: NotificationPriority
    let title: string

    const isBreach = currentPercentage >= 100

    if (riskType === 'daily_loss') {
        if (isBreach) {
            type = NotificationType.RISK_BREACH
            priority = NotificationPriority.CRITICAL
            title = 'ACCOUNT BREACH: Daily Loss Limit Exceeded'
        } else if (currentPercentage >= 95) {
            type = NotificationType.RISK_DAILY_LOSS_95
            priority = NotificationPriority.CRITICAL
            title = 'CRITICAL: Daily Loss Limit at 95%'
        } else {
            type = NotificationType.RISK_DAILY_LOSS_80
            priority = NotificationPriority.HIGH
            title = 'WARNING: Daily Loss Limit at 80%'
        }
    } else {
        if (isBreach) {
            type = NotificationType.RISK_BREACH
            priority = NotificationPriority.CRITICAL
            title = 'ACCOUNT BREACH: Max Drawdown Limit Exceeded'
        } else if (currentPercentage >= 95) {
            type = NotificationType.RISK_MAX_DRAWDOWN_95
            priority = NotificationPriority.CRITICAL
            title = 'CRITICAL: Max Drawdown at 95%'
        } else {
            type = NotificationType.RISK_MAX_DRAWDOWN_80
            priority = NotificationPriority.HIGH
            title = 'WARNING: Max Drawdown at 80%'
        }
    }

    const message = isBreach 
        ? `Your account "${metadata.accountName}" has breached the ${riskType === 'daily_loss' ? 'daily loss' : 'max drawdown'} limit. Current: $${metadata.used.toFixed(2)} / Limit: $${metadata.limit.toFixed(2)}`
        : `Your account "${metadata.accountName}" has used ${currentPercentage.toFixed(1)}% of the ${riskType === 'daily_loss' ? 'daily loss' : 'max drawdown'} limit. Current: $${metadata.used.toFixed(2)} / Limit: $${metadata.limit.toFixed(2)}`

    if (isBreach) {
        try {
            const user = await db.query.User.findFirst({
                where: eq(schema.User.id, userId)
            })
            if (user && user.email) {
                const breachTypeStr = riskType === 'daily_loss' ? 'Daily Loss Limit' : 'Max Drawdown Limit'
                await sendEmail({
                    to: user.email,
                    subject: `Prop Firm Rule Breach Detected: ${metadata.accountName}`,
                    html: `<p>Your prop firm account <strong>${escapeHtml(metadata.accountName)}</strong> has breached the ${escapeHtml(breachTypeStr)}.</p>
                           <p>Current: $${metadata.used.toFixed(2)} / Limit: $${metadata.limit.toFixed(2)} (${currentPercentage.toFixed(1)}%)</p>`
                })
            }
         } catch (error) {
           reportError(error, {
             surface: 'background-job',
             operation: 'send-risk-breach-email',
             userId,
             entityId: phaseAccountId,
           })
           /* Notification still persists when email delivery is unavailable. */
         }
    }

    return await createOrUpdateNotification(userId, {
        type,
        title,
        message,
        priority,
        actionRequired: priority === NotificationPriority.CRITICAL,
        invalidationKey: `risk_${riskType}_${phaseAccountId}`,
        data: {
            phaseAccountId,
            riskType,
            percentage: currentPercentage,
            ...metadata
        }
    })
}

/**
 * Import Lifecycle: Processing → Complete
 * Smart invalidation: Updates same notification from "processing" to "complete"
 * 
 * Example: "Import in progress" → "Import complete (145 trades)"
 */
export async function createImportNotification(
    userId: string,
    importId: string,
    status: 'processing' | 'complete',
    summary?: {
        tradesImported?: number
        errors?: number
        warnings?: number
        duration?: number
    }
) {
    if (status === 'processing') {
        return await createOrUpdateNotification(userId, {
            type: NotificationType.IMPORT_PROCESSING,
            title: 'Import in Progress',
            message: 'Your trades are being imported. This may take a few moments...',
            priority: NotificationPriority.MEDIUM,
            invalidationKey: `import_${importId}`,
            data: {
                importId,
                status: 'processing',
                startedAt: new Date().toISOString()
            }
        })
    } else {
        const hasErrors = summary?.errors && summary.errors > 0
        const title = hasErrors
            ? `Import Complete (${summary.errors} errors)`
            : 'Import Complete'

        const message = summary
            ? `Successfully imported ${summary.tradesImported} trades in ${summary.duration}s. ${hasErrors ? `${summary.errors} errors found.` : ''}`
            : 'Your trades have been imported successfully.'

        return await createOrUpdateNotification(userId, {
            type: NotificationType.IMPORT_COMPLETE,
            title,
            message,
            priority: hasErrors ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
            actionRequired: Boolean(hasErrors),
            invalidationKey: `import_${importId}`,
            data: {
                importId,
                status: 'complete',
                summary,
                completedAt: new Date().toISOString()
            }
        })
    }
}

/**
 * System Announcement: Admin-to-user broadcasts
 * No invalidation - each announcement is unique
 */
async function createSystemAnnouncement(
    userId: string,
    title: string,
    message: string,
    priority: NotificationPriority = NotificationPriority.MEDIUM
) {
    return await createOrUpdateNotification(userId, {
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title,
        message,
        priority,
        actionRequired: false
        // No invalidationKey - each announcement is unique
    })
}

/**
 * Dismiss all notifications of a specific type
 */
export async function dismissNotificationsByType(userId: string, type: NotificationType) {
    try {
        await db.update(schema.Notification)
            .set({ isRead: true })
            .where(
                and(
                    eq(schema.Notification.userId, userId),
                    eq(schema.Notification.type, type),
                    eq(schema.Notification.isRead, false)
                )
            )

        revalidateTag(`notifications-${userId}`)
        return { success: true }
    } catch (error) {
        return { success: false, error: 'Failed to dismiss notifications' }
    }
}

/**
 * Get notification statistics (for dashboard)
 */
export async function getNotificationStats(userId: string) {
    try {
        const [[totalRes], [unreadRes], [criticalRes]] = await Promise.all([
            db.select({ value: count() }).from(schema.Notification).where(eq(schema.Notification.userId, userId)),
            db.select({ value: count() }).from(schema.Notification).where(
                and(
                    eq(schema.Notification.userId, userId),
                    eq(schema.Notification.isRead, false)
                )
            ),
            db.select({ value: count() }).from(schema.Notification).where(
                and(
                    eq(schema.Notification.userId, userId),
                    eq(schema.Notification.isRead, false),
                    eq(schema.Notification.priority, NotificationPriority.CRITICAL)
                )
            )
        ])

        const total = totalRes?.value || 0;
        const unread = unreadRes?.value || 0;
        const critical = criticalRes?.value || 0;

        return {
            success: true,
            data: { total, unread, critical }
        }
    } catch (error) {
        return {
            success: false,
            error: 'Failed to get notification stats'
        }
    }
}
