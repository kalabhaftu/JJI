'use server'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { NotificationType } from '@/lib/db/schema'
import { getInternalUserId } from '@/server/user-identity'
import { revalidateTag } from 'next/cache'

import { eq, and, desc, count } from 'drizzle-orm'

async function createNotificationAction(data: {
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  actionRequired?: boolean
}) {
  try {
    const userId = await getInternalUserId()
    if (!userId) return { success: false, error: 'Unauthorized' }

    const notification = (await db.insert(schema.Notification).values({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data ?? undefined,
      actionRequired: data.actionRequired ?? false,
      updatedAt: new Date()
    }).returning())[0]

    revalidateTag(`notifications-${userId}`)
    return { success: true, data: notification }
  } catch (error) {
    return { success: false, error: 'Failed to create notification' }
  }
}

async function getNotificationsAction(options?: {
  unreadOnly?: boolean
  limit?: number
}) {
  const userId = await getInternalUserId()
  if (!userId) throw new Error('Unauthorized')

  const notifications = await db.query.Notification.findMany({
    where: (table, { eq, and }) => {
      const conditions = [eq(table.userId, userId)]
      if (options?.unreadOnly) conditions.push(eq(table.isRead, false))
      return and(...conditions)
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit: options?.limit || 50
  })

  return notifications
}

async function getUnreadCountAction() {
  const userId = await getInternalUserId()
  if (!userId) return 0

  const result = await db.select({ count: count() })
    .from(schema.Notification)
    .where(and(eq(schema.Notification.userId, userId), eq(schema.Notification.isRead, false)))

  return result[0]?.count || 0
}

async function markNotificationReadAction(notificationId: string) {
  try {
    const userId = await getInternalUserId()
    if (!userId) return { success: false, error: 'Unauthorized' }

    const notification = (await db.update(schema.Notification).set({ isRead: true, updatedAt: new Date() }).where(and(eq(schema.Notification.id, notificationId), eq(schema.Notification.userId, userId))).returning())[0]

    revalidateTag(`notifications-${userId}`)
    return { success: true, data: notification }
  } catch (error) {
    return { success: false, error: 'Failed to mark as read' }
  }
}

async function markAllNotificationsReadAction() {
  const userId = await getInternalUserId()
  if (!userId) return { success: false, error: 'Unauthorized' }

  await db.update(schema.Notification).set({ isRead: true, updatedAt: new Date() }).where(and(eq(schema.Notification.userId, userId), eq(schema.Notification.isRead, false)))

  revalidateTag(`notifications-${userId}`)
}

async function deleteNotificationAction(notificationId: string) {
  try {
    const userId = await getInternalUserId()
    if (!userId) return { success: false, error: 'Unauthorized' }

    await db.delete(schema.Notification).where(and(eq(schema.Notification.id, notificationId), eq(schema.Notification.userId, userId)))

    revalidateTag(`notifications-${userId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to delete notification' }
  }
}

/**
 * Handle funded approval action from user
 * User clicks "Firm Approved" → Create funded phase with account ID
 */
export async function handleFundedApprovalAction(data: {
  notificationId: string
  masterAccountId: string
  fundedAccountId: string
}) {
  const userId = await getInternalUserId()
  if (!userId) throw new Error('Unauthorized')

  const masterAccount = await db.query.MasterAccount.findFirst({
    where: (table, { eq, and }) => and(eq(table.id, data.masterAccountId), eq(table.userId, userId)),
    with: {
      PhaseAccount: {
        orderBy: (table, { desc }) => [desc(table.phaseNumber)]
      }
    }
  })

  if (!masterAccount) {
    throw new Error('Account not found')
  }

  const pendingPhase = masterAccount.PhaseAccount.find(p => p.status === 'pending_approval')
  if (!pendingPhase) {
    throw new Error('No pending approval found for this account')
  }

  await db.transaction(async (tx) => {
    // Determine funded phase based on evaluation type
    // For Instant accounts: the pending_approval phase IS the funded phase (phaseNumber = 1)
    // For One Step: funded is phase 2
    // For Two Step: funded is phase 3
    const isInstantAccount = masterAccount.evaluationType === 'Instant'

    if (isInstantAccount) {
      // For Instant accounts, the pending_approval phase IS the funded phase
      // Just update it directly with the new account ID and activate it
      await tx.update(schema.PhaseAccount).set({
        phaseId: data.fundedAccountId,
        status: 'active'
      }).where(eq(schema.PhaseAccount.id, pendingPhase.id))
    } else {
        await tx.update(schema.PhaseAccount).set({ status: 'passed' }).where(eq(schema.PhaseAccount.id, pendingPhase.id))

        const fundedPhaseNumber = pendingPhase.phaseNumber + 1
      const fundedPhase = masterAccount.PhaseAccount.find(p => p.phaseNumber === fundedPhaseNumber)

      if (!fundedPhase) {
        // Critical error: funded phase should always exist from account creation
        throw new Error(`Funded phase (phase ${fundedPhaseNumber}) not found for master account ${data.masterAccountId}. The account may be in a corrupted state.`)
      }

        await tx.update(schema.PhaseAccount).set({
          phaseId: data.fundedAccountId,
          status: 'active'
        }).where(eq(schema.PhaseAccount.id, fundedPhase.id))
    }

    const currentPhaseForFunded = isInstantAccount ? 1 : pendingPhase.phaseNumber + 1
    await tx.update(schema.MasterAccount).set({
      currentPhase: currentPhaseForFunded,
      status: 'funded',
      updatedAt: new Date()
    }).where(eq(schema.MasterAccount.id, data.masterAccountId))

    await tx.update(schema.Notification).set({
      isRead: true,
      actionRequired: false,
      updatedAt: new Date()
    }).where(eq(schema.Notification.id, data.notificationId))

    // Create approval notification
    await tx.insert(schema.Notification).values({
      userId,
      type: 'FUNDED_APPROVED',
      title: 'Funded Account Activated',
      message: `Congratulations! Your ${masterAccount.accountName} account is now funded.`,
      data: {
        masterAccountId: data.masterAccountId,
        fundedAccountId: data.fundedAccountId
      },
      actionRequired: false,
      updatedAt: new Date()
    })
  })

  revalidateTag(`notifications-${userId}`)
  revalidateTag(`accounts-${userId}`)
}

/**
 * Handle funded decline action from user
 * User clicks "Firm Declined" → Mark account as failed with reason
 */
export async function handleFundedDeclineAction(data: {
  notificationId: string
  masterAccountId: string
  reason: string
}) {
  const userId = await getInternalUserId()
  if (!userId) throw new Error('Unauthorized')

  const masterAccount = await db.query.MasterAccount.findFirst({
    where: (table, { eq, and }) => and(eq(table.id, data.masterAccountId), eq(table.userId, userId)),
    with: {
      PhaseAccount: true
    }
  })

  if (!masterAccount) {
    throw new Error('Account not found')
  }

  const pendingPhase = masterAccount.PhaseAccount.find(p => p.status === 'pending_approval')
  if (!pendingPhase) {
    throw new Error('No pending approval found for this account')
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.PhaseAccount).set({ status: 'failed' }).where(eq(schema.PhaseAccount.id, pendingPhase.id))

    await tx.update(schema.MasterAccount).set({ status: 'failed' }).where(eq(schema.MasterAccount.id, data.masterAccountId))

    await tx.update(schema.Notification).set({
      isRead: true,
      actionRequired: false,
      updatedAt: new Date()
    }).where(eq(schema.Notification.id, data.notificationId))

    await tx.insert(schema.Notification).values({
      userId,
      type: 'FUNDED_DECLINED',
      title: 'Funded Request Declined',
      message: `Your ${masterAccount.accountName} account was declined by the firm.`,
      data: {
        masterAccountId: data.masterAccountId,
        reason: data.reason,
        note: 'Met profit target but failed firm review'
      },
      actionRequired: false,
      updatedAt: new Date()
    })
  })

  revalidateTag(`notifications-${userId}`)
  revalidateTag(`accounts-${userId}`)
}
