import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/lib/query/query-keys'
import type { QueryScope } from '@/lib/query/query-scope'

const useQuery = vi.hoisted(() => vi.fn((options) => options))
const apiRequestData = vi.hoisted(() => vi.fn())
const demoData = vi.hoisted(() => ({ trades: [{ id: 'demo-trade' }], total: 1 }))

vi.mock('@tanstack/react-query', () => ({ useQuery }))
vi.mock('@/lib/api/client', () => ({ apiRequestData }))
vi.mock('@/lib/demo/mock-data', () => ({ getMockDemoData: () => demoData }))

import { useFilteredTrades } from '@/hooks/use-filtered-trades'

const scope: QueryScope = { surface: 'authenticated', userId: 'user-1' }

beforeEach(() => {
  vi.clearAllMocks()
  useQuery.mockImplementation((options) => options)
})

describe('useFilteredTrades query contract', () => {
  it('uses the canonical scoped trade key and forwards the query signal', async () => {
    apiRequestData.mockResolvedValue({ trades: [], total: 0 })
    const query = useFilteredTrades(scope, { instruments: ['ES'], includeStats: false }) as any
    const signal = new AbortController().signal

    expect(query.queryKey).toEqual(queryKeys.trades(scope, 'instruments=ES&includeStats=false'))
    await query.queryFn({ signal })
    expect(apiRequestData).toHaveBeenCalledWith(
      '/api/v1/trades?instruments=ES&includeStats=false',
      { signal, operation: 'load-filtered-trades' },
    )
  })

  it('preserves demo fixtures without calling the API client', async () => {
    const demoScope: QueryScope = { surface: 'demo' }
    const query = useFilteredTrades(demoScope, {}, true, true) as any

    await expect(query.queryFn({ signal: new AbortController().signal })).resolves.toBe(demoData)
    expect(query.queryKey).toEqual(queryKeys.trades(demoScope, ''))
    expect(apiRequestData).not.toHaveBeenCalled()
  })
})
