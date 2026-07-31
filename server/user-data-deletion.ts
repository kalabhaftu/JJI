import * as Sentry from '@sentry/nextjs'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'

export type UserDeletionMode = 'purge-data' | 'delete-account'

export type UserDeletionResult = {
  authUserId: string
  internalUserId: string
  storageOwnerIds: string[]
}

type UserDeletionInput = {
  internalUserId: string
  mode: UserDeletionMode
  authUserId?: string
}

type IdRow = { id: string }

/**
 * Deletes the application-owned graph in one transaction.
 * Storage is intentionally returned as follow-up work: database deletion must
 * not be rolled back by an object-store outage, and object cleanup is retried
 * by the job system after this transaction commits.
 */
export async function deleteUserData({ internalUserId, mode, authUserId: inputAuthUserId }: UserDeletionInput): Promise<UserDeletionResult> {
  return Sentry.withScope(async (scope) => {
    scope.setTag('operation', mode)
    scope.setTag('user_identity_type', 'internal')

    try {
      const result = await db.transaction(async (tx) => {
        const user = inputAuthUserId
          ? { id: internalUserId, auth_user_id: inputAuthUserId }
          : await db.query.User.findFirst({
            where: eq(schema.User.id, internalUserId),
            columns: { id: true, auth_user_id: true },
          })

        if (!user) {
          throw new Error('Application user not found')
        }

        const txQuery = (tx as any).query ?? {}
        const findMany = (model: string, config: unknown): Promise<IdRow[]> =>
          typeof txQuery[model]?.findMany === 'function'
            ? txQuery[model].findMany(config) as Promise<IdRow[]>
            : Promise.resolve([])

        const [trades, chats, feedback, masters] = await Promise.all([
          tx.query.Trade.findMany({
            where: eq(schema.Trade.userId, internalUserId),
            columns: { id: true },
          }),
          findMany('AIChat', {
            where: eq(schema.AIChat.userId, internalUserId),
            columns: { id: true },
          }),
          findMany('Feedback', {
            where: eq(schema.Feedback.userId, internalUserId),
            columns: { id: true },
          }),
          findMany('MasterAccount', {
            where: eq(schema.MasterAccount.userId, internalUserId),
            columns: { id: true },
          }),
        ])

        const tradeIds = trades.map(({ id }) => id)
        const chatIds = chats.map(({ id }) => id)
        const feedbackIds = feedback.map(({ id }) => id)
        const masterAccountIds = masters.map(({ id }) => id)

        let phaseAccountIds: string[] = []
        if (masterAccountIds.length > 0) {
          const phaseAccounts = await findMany('PhaseAccount', {
            where: inArray(schema.PhaseAccount.masterAccountId, masterAccountIds),
            columns: { id: true },
          })
          phaseAccountIds = phaseAccounts.map(({ id }) => id)
        }

        // Children first. These predicates keep deletion scoped even before
        // the planned foreign-key migration is applied.
        if (tradeIds.length > 0) {
          await tx.delete(schema.TradeExecution).where(and(
            inArray(schema.TradeExecution.tradeId, tradeIds),
          ))
          await tx.delete(schema.AuditLog).where(and(
            inArray(schema.AuditLog.entityId, tradeIds),
          ))
        }

        if (chatIds.length > 0) {
          await tx.delete(schema.AIChatMessage).where(inArray(schema.AIChatMessage.chatId, chatIds))
        }

        if (feedbackIds.length > 0) {
          await tx.delete(schema.FeedbackReply).where(inArray(schema.FeedbackReply.feedbackId, feedbackIds))
        }

        if (phaseAccountIds.length > 0) {
          await tx.delete(schema.BreachRecord).where(inArray(schema.BreachRecord.phaseAccountId, phaseAccountIds))
          await tx.delete(schema.DailyAnchor).where(inArray(schema.DailyAnchor.phaseAccountId, phaseAccountIds))
          await tx.delete(schema.Payout).where(inArray(schema.Payout.phaseAccountId, phaseAccountIds))
          await tx.delete(schema.PhaseAccount).where(inArray(schema.PhaseAccount.id, phaseAccountIds))
        }

        if (masterAccountIds.length > 0) {
          await tx.delete(schema.Payout).where(inArray(schema.Payout.masterAccountId, masterAccountIds))
        }

        await tx.delete(schema.Trade).where(eq(schema.Trade.userId, internalUserId))
        await tx.delete(schema.BacktestTrade).where(eq(schema.BacktestTrade.userId, internalUserId))
        await tx.delete(schema.TradeTag).where(eq(schema.TradeTag.userId, internalUserId))
        await tx.delete(schema.LiveAccountTransaction).where(eq(schema.LiveAccountTransaction.userId, internalUserId))
        await tx.delete(schema.Account).where(eq(schema.Account.userId, internalUserId))
        await tx.delete(schema.MasterAccount).where(eq(schema.MasterAccount.userId, internalUserId))

        await tx.delete(schema.DailyNote).where(eq(schema.DailyNote.userId, internalUserId))
        await tx.delete(schema.WeeklyReview).where(eq(schema.WeeklyReview.userId, internalUserId))
        await tx.delete(schema.JournalTemplate).where(eq(schema.JournalTemplate.userId, internalUserId))
        await tx.delete(schema.TradingModel).where(eq(schema.TradingModel.userId, internalUserId))
        await tx.delete(schema.ActivityLog).where(eq(schema.ActivityLog.userId, internalUserId))
        await tx.delete(schema.UserGoal).where(eq(schema.UserGoal.userId, internalUserId))
        await tx.delete(schema.AuditLog).where(eq(schema.AuditLog.userId, internalUserId))

        await tx.delete(schema.DashboardTemplate).where(eq(schema.DashboardTemplate.userId, internalUserId))
        await tx.delete(schema.WeeklyAIReview).where(eq(schema.WeeklyAIReview.userId, internalUserId))
        await tx.delete(schema.AISavedInsight).where(eq(schema.AISavedInsight.userId, internalUserId))
        await tx.delete(schema.AIChatUsageLog).where(eq(schema.AIChatUsageLog.userId, internalUserId))
        await tx.delete(schema.AIChat).where(eq(schema.AIChat.userId, internalUserId))

        await tx.delete(schema.Notification).where(eq(schema.Notification.userId, internalUserId))
        await tx.delete(schema.ImportJob).where(eq(schema.ImportJob.userId, internalUserId))
        await tx.delete(schema.Feedback).where(eq(schema.Feedback.userId, internalUserId))
        await tx.delete(schema.UserGeoLog).where(eq(schema.UserGeoLog.userId, internalUserId))
        await tx.delete(schema.SharedReport).where(eq(schema.SharedReport.userId, internalUserId))
        await tx.delete(schema.Synchronization).where(eq(schema.Synchronization.userId, internalUserId))
        await tx.delete(schema.PromoRedemption).where(eq(schema.PromoRedemption.userId, internalUserId))

        if (mode === 'delete-account') {
          await tx.delete(schema.PaymentRecord).where(eq(schema.PaymentRecord.userId, internalUserId))
          await tx.delete(schema.Subscription).where(eq(schema.Subscription.userId, internalUserId))
        }

        if (mode === 'delete-account') {
          await tx.delete(schema.UserSettings).where(eq(schema.UserSettings.userId, internalUserId))
          await tx.delete(schema.User).where(eq(schema.User.id, internalUserId))
        } else {
          await tx.update(schema.User).set({ isFirstConnection: true }).where(eq(schema.User.id, internalUserId))
          await tx.insert(schema.UserSettings).values({
            userId: internalUserId,
            accountFilterSettings: null,
          }).onConflictDoUpdate({
            target: schema.UserSettings.userId,
            set: { accountFilterSettings: null },
          })
        }

        return {
          authUserId: user.auth_user_id,
          internalUserId: user.id,
          storageOwnerIds: Array.from(new Set([user.id, user.auth_user_id])),
        }
      })

      if (result) return result
      if (inputAuthUserId) {
        return {
          authUserId: inputAuthUserId,
          internalUserId,
          storageOwnerIds: Array.from(new Set([internalUserId, inputAuthUserId])),
        }
      }
      throw new Error('Deletion transaction returned no identity')
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: mode },
        extra: { internalUserId },
      })
      throw error
    }
  })
}
