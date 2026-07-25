/**
 * Unified Cache Layer
 * 
 * Automatically uses Redis when available, falls back to memory cache
 * Provides a unified API regardless of backend
 */

import {
  getFromCache as redisGet,
  setInCache as redisSet,
  isRedisAvailable,
  CachePrefix,
  CacheTTL,
} from './redis-cache'

import { memGet, memSet } from './memory-cache'

export { CachePrefix, CacheTTL }

/**
 * Get value from cache (Redis or memory)
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (isRedisAvailable()) {
    return await redisGet<T>(key)
  }
  
  return memGet<T>(key)
}

/**
 * Set value in cache (Redis or memory)
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttl: number = CacheTTL.SHORT
): Promise<boolean> {
  if (isRedisAvailable()) {
    return await redisSet(key, value, ttl)
  }
  
  memSet(key, value, ttl)
  return true
}

/**
 * Get or set pattern (cache-aside) - unified
 */
export async function getOrSetCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CacheTTL.SHORT
): Promise<T> {
  const cached = await getCached<T>(key)
  if (cached !== null) {
    return cached
  }

  const data = await fetcher()

  await setCached(key, data, ttl)

  return data
}
