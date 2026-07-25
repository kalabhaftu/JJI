/**
 * Redis/Upstash Caching Layer
 * 
 * Provides high-performance caching for frequently accessed data
 * Uses the shared Upstash Redis client.
 * 
 * Usage:
 * 1. Set up Upstash Redis
 * 2. Add environment variables: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * 3. Use cache functions in API routes
 */

import { isRedisConfigured, redis } from './client'

// Cache key prefixes for organization
export const CachePrefix = {
  DASHBOARD_STATS: 'dashboard:stats:',
  USER_DATA: 'user:data:',
  ACCOUNT_LIST: 'account:list:',
  TRADE_LIST: 'trade:list:',
  CALENDAR_DATA: 'calendar:data:',
  MARKET_DATA: 'market:data:',
  AI_CONTEXT: 'ai:context:',
} as const

// Cache TTLs (Time To Live) in seconds
export const CacheTTL = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 1800,       // 30 minutes
  VERY_LONG: 3600,  // 1 hour
  EXTRA_LONG: 86400, // 24 hours
} as const

/**
 * Get data from cache
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    if (!isRedisAvailable()) {
      return null
    }

    const data = await redis.get<T>(key)
    return data
  } catch (error) {
    return null
  }
}

/**
 * Set data in cache with TTL
 */
export async function setInCache<T>(
  key: string,
  value: T,
  ttl: number = CacheTTL.SHORT
): Promise<boolean> {
  try {
    if (!isRedisAvailable()) {
      return false
    }

    await redis.set(key, value, { ex: ttl })
    return true
  } catch (error) {
    return false
  }
}

/**
 * Delete key from cache
 */
export async function deleteFromCache(key: string): Promise<boolean> {
  try {
    if (!isRedisAvailable()) {
      return false
    }

    await redis.del(key)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Delete multiple keys by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  try {
    if (!isRedisAvailable()) {
      return 0
    }

    let cursor = '0'
    let deleted = 0
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 })
      cursor = String(nextCursor)
      if (keys.length > 0) {
        await redis.del(...keys)
        deleted += keys.length
      }
    } while (cursor !== '0')
    return deleted
  } catch (error) {
    return 0
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return isRedisConfigured()
}

/**
 * Get or set pattern (cache-aside)
 * Tries to get from cache first, if miss, fetches data and caches it
 */
async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CacheTTL.SHORT
): Promise<T> {
  const cached = await getFromCache<T>(key)
  if (cached !== null) {
    return cached
  }

  const data = await fetcher()

  await setInCache(key, data, ttl)

  return data
}

/**
 * Invalidate user-specific caches
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    deleteCachePattern(`${CachePrefix.DASHBOARD_STATS}${userId}*`),
    deleteCachePattern(`${CachePrefix.USER_DATA}${userId}*`),
    deleteCachePattern(`${CachePrefix.ACCOUNT_LIST}${userId}*`),
    deleteCachePattern(`${CachePrefix.TRADE_LIST}${userId}*`),
    deleteCachePattern(`${CachePrefix.CALENDAR_DATA}${userId}*`),
    deleteCachePattern(`${CachePrefix.AI_CONTEXT}${userId}:*`),
  ])
}

/**
 * Cache wrapper for dashboard stats
 */
async function getCachedDashboardStats<T>(
  userId: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = `${CachePrefix.DASHBOARD_STATS}${userId}`
  return getOrSet(key, fetcher, CacheTTL.SHORT)
}

/**
 * Cache wrapper for user data
 */
async function getCachedUserData<T>(
  userId: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = `${CachePrefix.USER_DATA}${userId}`
  return getOrSet(key, fetcher, CacheTTL.MEDIUM)
}

/**
 * Cache wrapper for account list
 */
async function getCachedAccounts<T>(
  userId: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = `${CachePrefix.ACCOUNT_LIST}${userId}`
  return getOrSet(key, fetcher, CacheTTL.MEDIUM)
}

/**
 * Cache wrapper for trade list
 */
async function getCachedTrades<T>(
  userId: string,
  filters: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = `${CachePrefix.TRADE_LIST}${userId}:${filters}`
  return getOrSet(key, fetcher, CacheTTL.SHORT)
}

/**
 * Cache wrapper for calendar data
 */
async function getCachedCalendarData<T>(
  userId: string,
  month: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = `${CachePrefix.CALENDAR_DATA}${userId}:${month}`
  return getOrSet(key, fetcher, CacheTTL.MEDIUM)
}
