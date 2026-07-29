import { reportError } from '@/lib/observability/report-error'

export async function invalidateUserAccountCaches(
  userId: string,
  requestId?: string,
): Promise<void> {
  try {
    const { invalidateUserCache, bumpUserCacheVersion } = await import(
      '@/lib/cache/helpers'
    )
    await bumpUserCacheVersion(userId)
    await invalidateUserCache(userId)
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'invalidate-account-redis-cache',
      userId,
      ...(requestId ? { requestId } : {}),
    })
  }

  try {
    const { revalidateTag } = await import('next/cache')
    for (const tag of [
      `accounts-${userId}`,
      `user-data-${userId}`,
      `grouped-trades-${userId}`,
      `trades-${userId}`,
      `prop-firm-accounts-${userId}`,
      `prop-firm-phases-${userId}`,
    ]) {
      revalidateTag(tag)
    }
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'invalidate-account-next-cache',
      userId,
      ...(requestId ? { requestId } : {}),
    })
  }
}
