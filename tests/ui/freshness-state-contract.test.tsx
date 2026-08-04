import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('data freshness state contract', () => {
  it('defines the exact shared freshness interface', () => {
    const types = source('lib/realtime/types.ts')

    expect(types).toContain("export interface FreshnessState {\n  source: 'realtime' | 'polling' | 'cache' | 'unknown'\n  status: 'current' | 'stale' | 'degraded' | 'offline'\n  updatedAt: Date | null\n  staleSince: Date | null\n}")
  })

  it('exposes freshness through the data context', () => {
    const providerTypes = source('context/data-provider/types.ts')
    const provider = source('context/data-provider.tsx')

    expect(providerTypes).toContain('freshness: FreshnessState')
    expect(provider).toContain('const freshness = useDataProviderRealtime({')
    expect(provider).toContain('freshness,')
  })

  it('keeps degraded polling scoped to the data-provider owner', () => {
    const reconnectRefetcher = source('components/reconnect-refetcher.tsx')
    const realtimeHook = source('hooks/use-data-provider-realtime.ts')

    expect(reconnectRefetcher).not.toContain('invalidateQueries')
    expect(realtimeHook).toContain("type: 'active'")
    expect(realtimeHook).toContain('predicate:')
  })
})
