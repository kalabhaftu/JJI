import { redis } from './client'
import logger from '../logger'
import { getSafeErrorMessage } from '@/lib/observability/report-error'

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
    logger.warn({ key, error: getSafeErrorMessage(err) }, 'cache:read-failed - computing fresh')
  }

  logger.debug({ key }, 'cache:miss')
  const result = await fn()

  try {
    await redis.set(key, result, { ex: ttl })
  } catch (err) {
    logger.warn({ key, error: getSafeErrorMessage(err) }, 'cache:write-failed - result still returned')
  }

  return result
}

/**
 * Delete one or more cache keys.
 * Fails silently - a cache invalidation failure is not fatal.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return
  try {
    await redis.del(...keys)
    logger.debug({ keys }, 'cache:invalidated')
  } catch (err) {
    logger.warn({ keys, error: getSafeErrorMessage(err) }, 'cache:invalidation-failed')
  }
}

/**
 * Get current user cache version for atomic cache invalidation.
 * Defaults to 1 if missing or on error.
 */
export async function getUserCacheVersion(userId: string): Promise<number> {
  try {
    const { CacheKeys } = await import('./keys')
    const verKey = CacheKeys.userVersion(userId)
    const ver = await redis.get<number>(verKey)
    if (typeof ver === 'number' && ver > 0) {
      return ver
    }
    // Initialize version to 1 if not set
    await redis.set(verKey, 1)
    return 1
  } catch (err) {
    logger.warn({ userId, error: getSafeErrorMessage(err) }, 'cache:get-user-version-failed - fallback to 1')
    return 1
  }
}

/**
 * Bump user cache version.
 * Atomically invalidates all versioned user cache keys in 1 fast Redis command.
 */
export async function bumpUserCacheVersion(userId: string): Promise<number> {
  try {
    const { CacheKeys } = await import('./keys')
    const verKey = CacheKeys.userVersion(userId)
    // Upstash Redis incr command increments numeric key atomically
    const newVer = await redis.incr(verKey)
    logger.debug({ userId, newVer }, 'cache:user-version-bumped')
    return typeof newVer === 'number' ? newVer : 1
  } catch (err) {
    logger.warn({ userId, error: getSafeErrorMessage(err) }, 'cache:bump-user-version-failed')
    return 1
  }
}

/**
 * Invalidate all cache keys for a given account & user.
 * Call this after any trade mutation (import, edit, delete).
 */
export async function invalidateAccountCache(
  userId: string,
  accountId: string,
): Promise<void> {
  const { CacheKeys } = await import('./keys')
  // Bump version to instantly invalidate all versioned queries for this user
  await bumpUserCacheVersion(userId)

  // Also delete explicit non-versioned legacy keys
  await invalidateCache(
    CacheKeys.accountMetrics(accountId),
    CacheKeys.tradeStats(accountId),
    CacheKeys.propFirmPhase(accountId),
    CacheKeys.userAccounts(userId),
  )
}

/**
 * Invalidate all caches for a user (account list, metrics, trade lists, etc.)
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  const { CacheKeys } = await import('./keys')
  await bumpUserCacheVersion(userId)
  await invalidateCache(
    CacheKeys.userAccounts(userId)
  )
}
