/**
 * Unified Cache Manager
 * Single cache system for all application data
 */

import { CACHE_DURATION_SHORT, MAX_CACHE_ITEMS } from '@/lib/constants'
import logger from "@/lib/logger";
import * as Sentry from '@sentry/nextjs'

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
  tags: string[]
}

type CacheInvalidationCallback = (tags: string[]) => void

class CacheManagerClass {
  private static instance: CacheManagerClass | null = null
  
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  private invalidationCallbacks: Set<CacheInvalidationCallback> = new Set()
  private cleanupInterval: NodeJS.Timeout | null = null

  private constructor() {
    if (typeof window !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000) // Every minute
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CacheManagerClass {
    if (!CacheManagerClass.instance) {
      CacheManagerClass.instance = new CacheManagerClass()
    }
    return CacheManagerClass.instance
  }

  /**
   * Get data from cache
   * 
   * @param key - Cache key
   * @param options - Options for cache retrieval
   * @returns Cached data or null if not found/expired
   */
  get<T>(key: string, options?: { ignoreExpiry?: boolean }): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    
    if (!entry) {
      return null
    }

    if (!options?.ignoreExpiry && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Get data with stale-while-revalidate support
   * Returns stale data while allowing background refresh
   * 
   * @param key - Cache key
   * @returns Object with data and staleness info
   */
  getWithStale<T>(key: string): { data: T | null; isStale: boolean; age: number } {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    
    if (!entry) {
      return { data: null, isStale: true, age: Infinity }
    }

    const age = Date.now() - entry.timestamp
    const isStale = Date.now() > entry.expiresAt

    return {
      data: entry.data,
      isStale,
      age
    }
  }

  /**
   * Set data in cache
   * 
   * @param key - Cache key
   * @param data - Data to cache
   * @param options - Cache options
   */
  set<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number
      tags?: string[]
    } = {}
  ): void {
    const { ttl = CACHE_DURATION_SHORT, tags = [] } = options
    const now = Date.now()

    if (this.cache.size >= MAX_CACHE_ITEMS) {
      this.evictOldest()
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      tags
    })
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Invalidate cache entries by tag
   * 
   * @param tags - Tags to invalidate
   */
  invalidateByTag(tags: string[]): void {
    const tagsSet = new Set(tags)
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tagsSet.has(tag))) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
    }

    this.notifyInvalidation(tags)
  }

  /**
   * Invalidate all cache entries matching a key pattern
   * 
   * @param pattern - Key pattern (supports * wildcard)
   */
  invalidateByPattern(pattern: string): void {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    const keysToDelete: string[] = []
    const affectedTags = new Set<string>()

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(key)) {
        keysToDelete.push(key)
        entry.tags.forEach(tag => affectedTags.add(tag))
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
    }

    if (affectedTags.size > 0) {
      this.notifyInvalidation(Array.from(affectedTags))
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const allTags = new Set<string>()
    for (const entry of this.cache.values()) {
      entry.tags.forEach(tag => allTags.add(tag))
    }

    this.cache.clear()
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('accounts-store')
        localStorage.removeItem('equity-chart-store')
      } catch (error) {
        Sentry.captureException(error, { extra: { route: 'lib/cache/cache-manager', phase: 'clearLocalStorage' } })
        // Ignore localStorage errors
      }
    }

    this.notifyInvalidation(Array.from(allTags))
  }

  /**
   * Subscribe to cache invalidation events
   * 
   * @param callback - Callback when cache is invalidated
   * @returns Unsubscribe function
   */
  onInvalidation(callback: CacheInvalidationCallback): () => void {
    this.invalidationCallbacks.add(callback)
    return () => this.invalidationCallbacks.delete(callback)
  }

  /**
   * Notify all invalidation subscribers
   */
  private notifyInvalidation(tags: string[]): void {
    for (const callback of this.invalidationCallbacks) {
      try {
        callback(tags)
      } catch (error) {
        logger.error({ err: error }, 'Error in cache invalidation callback:')
      }
    }
  }

  /**
   * Remove oldest entries when at capacity
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    tags: string[]
  } {
    const allTags = new Set<string>()
    for (const entry of this.cache.values()) {
      entry.tags.forEach(tag => allTags.add(tag))
    }

    return {
      size: this.cache.size,
      maxSize: MAX_CACHE_ITEMS,
      tags: Array.from(allTags)
    }
  }

  /**
   * Destroy the cache manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
    this.invalidationCallbacks.clear()
    CacheManagerClass.instance = null
  }
}

export const CacheManager = CacheManagerClass.getInstance()

/**
 * Cache key generators for common patterns
 */
export const CacheKeys = {
  accounts: (userId: string) => `accounts:${userId}`,
  trades: (userId: string, accountId?: string) => 
    accountId ? `trades:${userId}:${accountId}` : `trades:${userId}`,
  statistics: (userId: string, filters?: string) => 
    filters ? `stats:${userId}:${filters}` : `stats:${userId}`,
  propFirmAccount: (accountId: string) => `propfirm:${accountId}`,
  dashboard: (userId: string) => `dashboard:${userId}`
}

/**
 * Cache tags for invalidation
 */
export const CacheTags = {
  ACCOUNTS: 'accounts',
  TRADES: 'trades',
  STATISTICS: 'statistics',
  PROP_FIRM: 'propfirm',
  DASHBOARD: 'dashboard',
  USER: 'user'
}

/**
 * Invalidate all user-related caches
 */
export function invalidateUserCaches(userId: string): void {
  CacheManager.invalidateByPattern(`*:${userId}*`)
  CacheManager.invalidateByTag([CacheTags.ACCOUNTS, CacheTags.TRADES, CacheTags.STATISTICS])
}

/**
 * React hook for cache invalidation subscription
 */
export function useCacheInvalidation(
  callback: CacheInvalidationCallback,
  tags?: string[]
): void {
  const { useEffect, useRef, useMemo } = require('react')
  const callbackRef = useRef(callback)
  const tagsRef = useRef(tags)
  
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    tagsRef.current = tags
  }, [tags])

  const tagsKey = tags?.join(',') ?? ''

  const memoizedTags = useMemo(() => {
    const currentTags = tagsRef.current
    return currentTags ? [...currentTags] : currentTags
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagsKey])

  useEffect(() => {
    const unsubscribe = CacheManager.onInvalidation((invalidatedTags) => {
      const currentTags = tagsRef.current
      if (currentTags) {
        const hasMatch = invalidatedTags.some(tag => currentTags.includes(tag))
        if (hasMatch) {
          callbackRef.current(invalidatedTags)
        }
      } else {
        callbackRef.current(invalidatedTags)
      }
    })

    return unsubscribe
  }, [tagsKey])
}

export default CacheManager

