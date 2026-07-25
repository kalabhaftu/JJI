import { redis } from './client'
import logger from '../logger'

/**
 * Generic cache wrapper.
 * - On cache hit: returns cached value immediately
 * - On cache miss: runs fn(), stores result, returns it
 * - On Redis error: logs warning, runs fn() directly (fail open)
 */
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

/**
 * Delete one or more cache keys.
 * Fails silently - a cache invalidation failure is not fatal.
 */
async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return
  try {
    await redis.del(...keys)
    logger.debug({ keys }, 'cache:invalidated')
  } catch (err) {
    logger.warn({ keys, err }, 'cache:invalidation-failed')
  }
}

/**
 * Invalidate all cache keys for a given account.
 * Call this after any trade mutation (import, edit, delete).
 */
export async function invalidateAccountCache(
  userId: string,
  accountId: string,
): Promise<void> {
  // We can't enumerate pattern-matched keys on Upstash free tier (no SCAN),
  // so we invalidate the known fixed keys and accept that date-range keys
  // will expire naturally via TTL.
  const { CacheKeys } = await import('./keys')
  await invalidateCache(
    CacheKeys.performanceScore(userId, accountId),
    CacheKeys.accountMetrics(accountId),
    CacheKeys.tradeStats(accountId),
    CacheKeys.propFirmPhase(accountId),
    CacheKeys.userAccounts(userId),
  )
}
