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

  it('does not use legacy cache clearing or broad query invalidation', () => {
    const realtimeHook = source('hooks/use-data-provider-realtime.ts')

    expect(realtimeHook).not.toContain('clearTradesCache')
    expect(realtimeHook).not.toContain('clearAccountsCache')
    expect(realtimeHook).not.toContain("['v1', 'trades']")
    expect(realtimeHook).not.toContain("['dashboard-stats']")
    expect(realtimeHook).not.toContain("['report-stats']")
    expect(realtimeHook).not.toContain("['propfirm-stats']")
  })

  it('uses RealtimeStatus without legacy callback overloads', () => {
    const realtime = source('lib/realtime/database-realtime.ts')

    expect(realtime).not.toContain('LegacyRealtimeStatus')
    expect(realtime).not.toContain('bivarianceHack')
    expect(realtime).toContain('onStatusChange?: (status: RealtimeStatus) => void')
  })

  it('keeps trade mutation and manual refresh owners on canonical scoped keys', () => {
    const mutations = source('hooks/use-data-provider-trade-mutations.ts')
    const provider = source('context/data-provider.tsx')

    expect(mutations).toContain('queryKeyPrefixes.trades(scope)')
    expect(mutations).not.toContain("['v1', 'trades']")
    expect(provider).toContain('queryKeyPrefixes.trades({ surface: \'authenticated\', userId: user.id })')
    expect(provider).not.toContain("queryKey: ['v1']")
  })
})
