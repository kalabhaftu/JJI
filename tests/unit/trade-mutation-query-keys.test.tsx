import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryKeyPrefixes, queryKeys } from '@/lib/query/query-keys'

const apiRequest = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { updated: 1 } }))
vi.mock('@/lib/api/client', () => ({ apiRequest }))

import { useDataProviderTradeMutations } from '@/hooks/use-data-provider-trade-mutations'

type Mutations = ReturnType<typeof useDataProviderTradeMutations>

const SCOPE = { surface: 'authenticated' as const, userId: 'user-1' }
const TABLE_KEY = queryKeys.trades(SCOPE, 'table')
const METRICS_KEY = queryKeys.trades(SCOPE, 'metrics')

function Probe({ queryClient, capture }: { queryClient: any; capture: (value: Mutations) => void }) {
  capture(useDataProviderTradeMutations({ userId: SCOPE.userId, queryClient }))
  return null
}

function snapshotQueryClient() {
  return {
    getQueriesData: vi.fn().mockReturnValue([
      [TABLE_KEY, { trades: [{ id: 'trade-1', instrument: 'ES', tags: [] }] }],
      [METRICS_KEY, { trades: [{ id: 'trade-1', instrument: 'ES', tags: [] }] }],
    ]),
    setQueriesData: vi.fn(),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  }
}

afterEach(() => vi.clearAllMocks())

describe('trade mutation query ownership', () => {
  it('patches the canonical trades prefix and invalidates each touched query', async () => {
    const queryClient = snapshotQueryClient()
    let mutations!: Mutations
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      queryClient,
      capture: (value) => { mutations = value },
    })))

    await act(async () => mutations.updateTrades(['trade-1'], { instrument: 'NQ' }))

    const prefix = queryKeyPrefixes.trades(SCOPE)
    expect(queryClient.getQueriesData).toHaveBeenCalledWith({ queryKey: prefix })
    expect(queryClient.setQueriesData).toHaveBeenCalledWith({ queryKey: prefix }, expect.any(Function))
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: TABLE_KEY })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: METRICS_KEY })
    expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['v1', 'trades'] }, expect.anything())
    expect(queryClient.setQueriesData).not.toHaveBeenCalledWith({ queryKey: ['v1', 'trades'] }, expect.any(Function))
    await act(async () => root.unmount())
  })

  it('runs deleteTrades against the canonical trades prefix', async () => {
    const queryClient = snapshotQueryClient()
    let mutations!: Mutations
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      queryClient,
      capture: (value) => { mutations = value },
    })))

    await act(async () => mutations.deleteTrades(['trade-1']))

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/trades/batch/delete',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ tradeIds: ['trade-1'] }) }),
    )
    expect(queryClient.setQueriesData).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.trades(SCOPE) }, expect.any(Function))
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: TABLE_KEY })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: METRICS_KEY })
    await act(async () => root.unmount())
  })

  it('invalidates touched queries after groupTrades and ungroupTrades', async () => {
    const queryClient = snapshotQueryClient()
    let mutations!: Mutations
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      queryClient,
      capture: (value) => { mutations = value },
    })))

    await act(async () => mutations.groupTrades(['trade-1']))
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/trades/batch/group',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ tradeIds: ['trade-1'] }) }),
    )
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: TABLE_KEY })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: METRICS_KEY })

    queryClient.invalidateQueries.mockClear()
    await act(async () => mutations.ungroupTrades(['trade-1']))
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/trades/batch/ungroup',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ tradeIds: ['trade-1'] }) }),
    )
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: TABLE_KEY })
    await act(async () => root.unmount())
  })

  it('patches and invalidates the canonical prefix for appendTagsToTrades', async () => {
    const queryClient = snapshotQueryClient()
    let mutations!: Mutations
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      queryClient,
      capture: (value) => { mutations = value },
    })))

    await act(async () => mutations.appendTagsToTrades(['trade-1'], ['tag-1']))

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/trades/batch/tag',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tradeIds: ['trade-1'], tags: ['tag-1'], mode: 'append' }),
      }),
    )
    expect(queryClient.setQueriesData).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.trades(SCOPE) }, expect.any(Function))
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: TABLE_KEY })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: METRICS_KEY })
    await act(async () => root.unmount())
  })
})
