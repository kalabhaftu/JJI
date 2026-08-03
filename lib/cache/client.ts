import { Redis } from '@upstash/redis'
import logger from '@/lib/logger'

declare global {
    var _redis: Redis | undefined
}

export function isRedisConfigured(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  )
}

function createRedisClient(): Redis {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    logger.warn('Redis/KV credentials are not set. Cache will fail-open, but rate limits and cache-backed features will be degraded.')

    return {
      get: async () => null,
      set: async () => 'OK',
      setex: async () => 'OK',
      del: async () => 0,
      keys: async () => [],
      scan: async () => ['0', []],
      ping: async () => 'PONG',
    } as unknown as Redis
  }
  return new Redis({
    url,
    token,
  })
}

export const redis = global._redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') {
  global._redis = redis
}

