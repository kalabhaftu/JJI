import { invalidateAccountCache, bumpUserCacheVersion } from './helpers'
import { db } from '../db/client'

export async function invalidateTradesCache(userId: string, accountId?: string | null) {
  // Always bump user cache version so all versioned trade lists and analytics are invalidated immediately
  await bumpUserCacheVersion(userId)

  if (accountId) {
    await invalidateAccountCache(userId, accountId)
    return
  }

  // If no account ID is provided, invalidate all accounts for the user
  const accounts = await db.query.Account.findMany({
    where: (table, { eq }) => eq(table.userId, userId),
    columns: { id: true }
  })
  
  await Promise.all(
    accounts.map(acc => invalidateAccountCache(userId, acc.id))
  )
}

