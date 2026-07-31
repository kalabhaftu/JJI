
import { isRedisConfigured, redis } from './client'
import logger from '../logger'

export const CachePrefix = {
  DASHBOARD_STATS: 'dashboard:stats:',
  USER_DATA: 'user:data:',
  ACCOUNT_LIST: 'account:list:',
  TRADE_LIST: 'trade:list:',
  CALENDAR_DATA: 'calendar:data:',
  MARKET_DATA: 'market:data:',
  AI_CONTEXT: 'ai:context:',
} as const

export const CacheTTL = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 1800,       // 30 minutes
  VERY_LONG: 3600,  // 1 hour
  EXTRA_LONG: 86400, // 24 hours
} as const

export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    if (!isRedisAvailable()) {
      return null
    }

    const data = await redis.get<T>(key)
    return data
  } catch (error) {
    logger.warn({ error, key }, 'redis cache read failed')
    return null
  }
}

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
    logger.warn({ error, key }, 'redis cache write failed')
    return false
  }
}

export function isRedisAvailable(): boolean {
  return isRedisConfigured()
}
