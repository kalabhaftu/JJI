import { redis } from './client'
import { getCachedOrFetch } from './utils'
import { calculatePerformanceScore } from '@/lib/performance-score'

export async function getCachedPerformanceScore(userId: string, fetcher: () => Promise<ReturnType<typeof calculatePerformanceScore>>) {
  const key = `v2:jji:performance-score:${userId}`
  // Cache for 24 hours (86400 seconds) since it's a heavy calculation and only updates once a day
  return getCachedOrFetch(key, fetcher, 86400)
}

export async function invalidatePerformanceScore(userId: string) {
  const key = `v2:jji:performance-score:${userId}`
  await redis.del(key)
}
