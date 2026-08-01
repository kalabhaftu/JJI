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
import logger from '../logger'
import { getSafeErrorMessage } from '@/lib/observability/report-error'

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
    logger.warn({ error: getSafeErrorMessage(error), key }, 'redis cache read failed')
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
    logger.warn({ error: getSafeErrorMessage(error), key }, 'redis cache write failed')
    return false
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return isRedisConfigured()
}
