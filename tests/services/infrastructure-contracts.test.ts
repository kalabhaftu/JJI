import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CacheKeys, CacheTTL } from '@/lib/cache/keys'
import { getEmailRateLimitKey } from '@/lib/rate-limiter'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('production infrastructure contracts', () => {
  it('uses bounded, namespaced Redis keys with positive TTLs', () => {
    const keys = [
      CacheKeys.accountMetrics('account'),
      CacheKeys.tradeStats('account'),
      CacheKeys.dailyPnlSeries('account', 'from', 'to'),
      CacheKeys.equityCurve('account', 'from', 'to'),
      CacheKeys.drawdownCurve('account', 'from', 'to'),
      CacheKeys.widgetData('user', 'type', 'params'),
      CacheKeys.propFirmPhase('account'),
      CacheKeys.dailyAnchor('account', 'date'),
      CacheKeys.userAccounts('user'),
      getEmailRateLimitKey('Trader@example.com'),
    ]

    expect(keys.every((key) => /^[a-z0-9:-]+$/.test(key))).toBe(true)
    expect(Object.values(CacheTTL).every((ttl) => ttl > 0)).toBe(true)
  })

  it('does not enumerate Redis keys in request code', () => {
    const cacheSources = [
      source('lib/cache/helpers.ts'),
      source('lib/cache/redis-cache.ts'),
      source('lib/cache/unified-cache.ts'),
    ].join('\n')

    expect(cacheSources).not.toMatch(/redis\.(?:keys|scan)\s*\(/)
  })

  it('runs daily anchors from both cron and the explicit event', () => {
    const reset = source('lib/inngest/functions/reset-daily-anchors.ts')
    const breaches = source('lib/inngest/functions/check-breaches.ts')

    expect(reset).toContain("{ event: 'cron/daily-anchor-reset' }")
    expect(reset).toContain("{ cron: 'TZ=UTC 5 0 * * *' }")
    expect(reset).toContain('retries: 3')
    expect(reset).toContain('concurrency: { limit: 1 }')
    expect(breaches).toContain('retries: 3')
    expect(breaches).toContain('concurrency: { limit: 1 }')
  })

  it('uses a direct database URL for schema operations when available', () => {
    const config = source('drizzle.config.ts')

    expect(config).toContain('process.env.DIRECT_URL ?? process.env.DATABASE_URL')
    expect(config).toContain('strict: true')
  })
})
