import { invalidateAccountCache, bumpUserCacheVersion } from './helpers'
import { db } from '../db/client'

export async function invalidateTradesCache(userId: string, accountId?: string | null) {

  await bumpUserCacheVersion(userId)

  if (accountId) {
    await invalidateAccountCache(userId, accountId)
    return
  }


  const accounts = await db.query.Account.findMany({
    where: (table, { eq }) => eq(table.userId, userId),
    columns: { id: true }
  })
  
  await Promise.all(
    accounts.map(acc => invalidateAccountCache(userId, acc.id))
  )
}


