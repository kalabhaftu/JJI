import { db } from '@/lib/db/client'
import { AdminAISetting, User, AIChatUsageLog } from '@/lib/db/schema'
import { eq, and, gte, count } from 'drizzle-orm'
import { checkSubscriptionAccess } from './subscription-guard-service'
import { isRedisConfigured } from '@/lib/cache/client'

export interface AIGuardResult {
  hasAccess: boolean
  reason?: string
  settings?: any
}

async function hasReachedDailyDatabaseLimit(userId: string, dailyLimit: number) {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [result] = await db.select({ count: count() })
    .from(AIChatUsageLog)
    .where(
      and(
        eq(AIChatUsageLog.userId, userId),
        gte(AIChatUsageLog.createdAt, startOfDay),
      ),
    )

  return Number(result?.count ?? 0) >= dailyLimit
}

async function checkDailyQuota(userId: string, dailyLimit: number) {
  if (dailyLimit <= 0) return false


  if (isRedisConfigured()) return true
  if (process.env.NODE_ENV === 'production') return false

  return !(await hasReachedDailyDatabaseLimit(userId, dailyLimit))
}


export async function checkAIAccess(userId: string): Promise<AIGuardResult> {
  let settings = await db.query.AdminAISetting.findFirst({
    where: eq(AdminAISetting.id, 'global'),
  })

  if (!settings) {
    const [inserted] = await db.insert(AdminAISetting)
      .values({ id: 'global', updatedAt: new Date() })
      .returning()
    settings = inserted
  }

  if (!settings) {
    return { hasAccess: false, reason: 'Failed to initialize AI settings' }
  }


  if (!settings?.enabled) {
    return { hasAccess: false, reason: 'AI assistant is currently disabled by administrator.', settings }
  }


  const user = await db.query.User.findFirst({
    where: eq(User.id, userId),
    columns: { role: true },
  })

  if (!user) {
    return { hasAccess: false, reason: 'User not found.', settings }
  }

  const isAdmin = user.role === 'admin'


  if (isAdmin) {
    if (settings?.adminAccess) {
      return { hasAccess: true, settings }
    }
    return { hasAccess: false, reason: 'AI access is disabled for administrators.', settings }
  }


  const subStatus = await checkSubscriptionAccess(userId)
  const isPaid = subStatus.hasAccess && subStatus.status !== 'past_due'

  if (isPaid) {
    if (settings?.paidPlanAccess) {
      const dailyLimit = settings.maxMessagesPerDay ?? 0
      if (!(await checkDailyQuota(userId, dailyLimit))) {
        return { 
          hasAccess: false, 
          reason: dailyLimit <= 0 || (!isRedisConfigured() && process.env.NODE_ENV === 'production')
            ? 'AI messaging is currently unavailable for this account.'
            : `You have reached your daily limit of ${dailyLimit || 'default'} AI messages. Try again tomorrow.`,
          settings 
        }
      }

      return { hasAccess: true, settings }
    }
    return { hasAccess: false, reason: 'AI access is disabled for paid members.', settings }
  }


  if (settings?.freePlanAccess) {
    const dailyLimit = settings.maxMessagesPerDay ?? 0
    if (!(await checkDailyQuota(userId, dailyLimit))) {
      return { 
        hasAccess: false, 
        reason: dailyLimit <= 0 || (!isRedisConfigured() && process.env.NODE_ENV === 'production')
          ? 'AI messaging is currently unavailable for this account.'
          : `You have reached your daily limit of ${dailyLimit || 'default'} AI messages. Try again tomorrow.`,
        settings 
      }
    }

    return { hasAccess: true, settings }
  }

  return { 
    hasAccess: false, 
    reason: 'AI Assistant requires a paid subscription. Please upgrade your plan to gain access.', 
    settings 
  }
}

