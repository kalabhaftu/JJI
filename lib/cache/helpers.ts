import { redis } from './client'
import logger from '../logger'

export async function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  // Bypass cache in development to avoid stale data confusion
  if (process.env.NODE_ENV === 'development' && process.env.CACHE_IN_DEV !== 'true') {
    return fn()
  }

  try {
    const cached = await redis.get<T>(key)
    if (cached !== null && cached !== undefined) {
      logger.debug({ key }, 'cache:hit')
      return cached
    }
  } catch (err) {
    logger.warn({ key, err }, 'cache:read-failed - computing fresh')
  }

  logger.debug({ key }, 'cache:miss')
  const result = await fn()

  try {
    await redis.set(key, result, { ex: ttl })
  } catch (err) {
    logger.warn({ key, err }, 'cache:write-failed - result still returned')
  }

  return result
}

// Fails silently - a cache invalidation failure is not fatal.
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return
  try {
    await redis.del(...keys)
    logger.debug({ keys }, 'cache:invalidated')
  } catch (err) {
    logger.warn({ keys, err }, 'cache:invalidation-failed')
  }
}

// Defaults to 1 if missing or on error.
export async function getUserCacheVersion(userId: string): Promise<number> {
  try {
    const { CacheKeys } = await import('./keys')
    const verKey = CacheKeys.userVersion(userId)
    const ver = await redis.get<number>(verKey)
    if (typeof ver === 'number' && ver > 0) {
      return ver
    }
    await redis.set(verKey, 1)
    return 1
  } catch (err) {
    logger.warn({ userId, err }, 'cache:get-user-version-failed - fallback to 1')
    return 1
  }
}

export async function bumpUserCacheVersion(userId: string): Promise<number> {
  try {
    const { CacheKeys } = await import('./keys')
    const verKey = CacheKeys.userVersion(userId)
    const newVer = await redis.incr(verKey)
    logger.debug({ userId, newVer }, 'cache:user-version-bumped')
    return typeof newVer === 'number' ? newVer : 1
  } catch (err) {
    logger.warn({ userId, err }, 'cache:bump-user-version-failed')
    return 1
  }
}

export async function invalidateAccountCache(
  userId: string,
  accountId: string,
): Promise<void> {
  const { CacheKeys } = await import('./keys')
  await bumpUserCacheVersion(userId)

  await invalidateCache(
    CacheKeys.accountMetrics(accountId),
    CacheKeys.tradeStats(accountId),
    CacheKeys.propFirmPhase(accountId),
    CacheKeys.userAccounts(userId),
  )
}

export async function invalidateUserCache(userId: string): Promise<void> {
  const { CacheKeys } = await import('./keys')
  await bumpUserCacheVersion(userId)
  await invalidateCache(
    CacheKeys.userAccounts(userId)
  )
}
