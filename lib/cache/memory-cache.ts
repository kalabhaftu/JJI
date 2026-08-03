

interface CacheEntry<T> {
  value: T
  expires: number
  lastAccessed: number
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private maxSize: number = 100
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {

    if (typeof process !== 'undefined' && !this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup()
      }, 60000)
    }
  }


  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      return null
    }

    entry.lastAccessed = Date.now()
    return entry.value as T
  }


  set<T>(key: string, value: T, ttlSeconds: number = 60): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + (ttlSeconds * 1000),
      lastAccessed: Date.now()
    })
  }


  delete(key: string): void {
    this.cache.delete(key)
  }


  deletePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    let count = 0

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        count++
      }
    }

    return count
  }


  clear(): void {
    this.cache.clear()
  }


  size(): number {
    return this.cache.size
  }


  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime: number = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }


  private cleanup(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key)
      }
    }
  }


  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

const memoryCache = new MemoryCache()

export default memoryCache

export const memGet = <T>(key: string) => memoryCache.get<T>(key)
export const memSet = <T>(key: string, value: T, ttl?: number) => memoryCache.set(key, value, ttl)
export const memDelete = (key: string) => memoryCache.delete(key)
export const memDeletePattern = (pattern: string) => memoryCache.deletePattern(pattern)
const memClear = () => memoryCache.clear()
const memSize = () => memoryCache.size()


