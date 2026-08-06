import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/query-keys'

const apiRequest = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api/client', () => ({ apiRequest }))

import { useDataProviderTradeMutations } from '@/hooks/use-data-provider-trade-mutations'

type Mutations = ReturnType<typeof useDataProviderTradeMutations>

const SCOPE = { surface: 'authenticated' as const, userId: 'user-1' }
const TABLE_KEY = queryKeys.trades(SCOPE, 'table')
const METRICS_KEY = queryKeys.trades(SCOPE, 'metrics')

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function Probe({ queryClient, capture }: { queryClient: any; capture: (value: Mutations) => void }) {
  capture(useDataProviderTradeMutations({ userId: SCOPE.userId, queryClient }))
  return null
}

function seedData() {
  const trade1 = { id: 'trade-1', instrument: 'ES', tags: [] }
  const trade2 = { id: 'trade-2', instrument: 'NQ', tags: [] }
  const tableData = {
    trades: [trade1, trade2],
    total: 2,
    statistics: null,
    calendarData: { '2026-01-05': { trades: [trade1] } },
    widgets: { calendarData: { '2026-01-06': { trades: [trade2] } } },
  }
  const metricsData = {
    trades: [trade1, trade2],
    total: 2,
    statistics: { pnl: 25 },
    calendarData: null,
    widgets: null,
  }
  return { tableData, metricsData }
}

async function renderMutations(queryClient: QueryClient) {
  let mutations!: Mutations
  const root = createRoot(document.createElement('div'))
  await act(async () =>
    root.render(createElement(Probe, { queryClient, capture: (value) => { mutations = value } }))
  )
  return { mutations, root }
}

afterEach(() => vi.clearAllMocks())

describe('optimistic trade mutation rollback', () => {
  it('patches scoped trades queries optimistically and snapshots prior data before the request settles', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { tableData, metricsData } = seedData()
    queryClient.setQueryData(TABLE_KEY, tableData)
    queryClient.setQueryData(METRICS_KEY, metricsData)

    const pending = deferred<{ data: { updated: number } }>()
    apiRequest.mockReturnValueOnce(pending.promise)

    const { mutations, root } = await renderMutations(queryClient)
    let mutation!: Promise<void>
    await act(async () => {
      mutation = mutations.updateTrades(['trade-1'], { instrument: 'NQ' })
    })

    const patchedTable = queryClient.getQueryData(TABLE_KEY) as any
    expect(patchedTable.trades[0].instrument).toBe('NQ')
    expect(patchedTable.trades[1]).toBe(tableData.trades[1])
    expect(patchedTable.calendarData['2026-01-05'].trades[0].instrument).toBe('NQ')
    expect(patchedTable.widgets.calendarData['2026-01-06'].trades[0]).toBe(tableData.trades[1])

    const patchedMetrics = queryClient.getQueryData(METRICS_KEY) as any
    expect(patchedMetrics.trades[0].instrument).toBe('NQ')
    expect(patchedMetrics.trades[1]).toBe(tableData.trades[1])
    expect(patchedMetrics.statistics).toEqual({ pnl: 25 })

    await act(async () => {
      pending.resolve({ data: { updated: 1 } })
    })
    await act(async () => mutation)
    await act(async () => root.unmount())
  })

  it('restores every touched query to its snapshot and rethrows when the api call fails', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { tableData, metricsData } = seedData()
    queryClient.setQueryData(TABLE_KEY, tableData)
    queryClient.setQueryData(METRICS_KEY, metricsData)
    const demoTradeKey = queryKeys.trades({ surface: 'demo' }, 'table')
    const demoData = { trades: [{ id: 'trade-9', instrument: 'ES', tags: [] }], total: 1 }
    queryClient.setQueryData(demoTradeKey, demoData)

    apiRequest.mockRejectedValueOnce(new Error('boom'))

    const { mutations, root } = await renderMutations(queryClient)
    await act(async () => {
      await expect(mutations.updateTrades(['trade-1'], { instrument: 'NQ' })).rejects.toThrow('boom')
    })

    expect(queryClient.getQueryData(TABLE_KEY)).toEqual(tableData)
    expect(queryClient.getQueryData(METRICS_KEY)).toEqual(metricsData)
    expect(queryClient.getQueryData(demoTradeKey)).toBe(demoData)
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/trades/batch/update',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tradeIds: ['trade-1'], update: { instrument: 'NQ' } }),
      })
    )
    await act(async () => root.unmount())
  })

  it('invalidates queries and discards snapshots on success', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { tableData } = seedData()
    queryClient.setQueryData(TABLE_KEY, tableData)

    apiRequest.mockResolvedValueOnce({ data: { updated: 1 } })

    const { mutations, root } = await renderMutations(queryClient)
    await act(async () => {
      await mutations.updateTrades(['trade-1'], { instrument: 'NQ' })
    })

    expect(queryClient.getQueryState(TABLE_KEY)?.isInvalidated).toBe(true)
    const cached = queryClient.getQueryData(TABLE_KEY) as any
    expect(cached.trades[0].instrument).toBe('NQ')
    expect(cached.trades[1]).toBe(tableData.trades[1])
    await act(async () => root.unmount())
  })

  it('rolls back appendTagsToTrades optimistic tag patches on failure', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { tableData } = seedData()
    queryClient.setQueryData(TABLE_KEY, tableData)

    apiRequest.mockRejectedValueOnce(new Error('tag boom'))

    const { mutations, root } = await renderMutations(queryClient)
    await act(async () => {
      await expect(mutations.appendTagsToTrades(['trade-1'], ['tag-1'])).rejects.toThrow('tag boom')
    })

    expect(queryClient.getQueryData(TABLE_KEY)).toEqual(tableData)
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/trades/batch/tag',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tradeIds: ['trade-1'], tags: ['tag-1'], mode: 'append' }),
      })
    )
    await act(async () => root.unmount())
  })

  it('does not roll back queries that had no data before the mutation', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { tableData } = seedData()
    const emptyKey = queryKeys.trades(SCOPE, 'empty')
    queryClient.setQueryData(TABLE_KEY, tableData)
    queryClient.setQueryData(emptyKey, undefined)

    apiRequest.mockRejectedValueOnce(new Error('boom'))

    const { mutations, root } = await renderMutations(queryClient)
    await act(async () => {
      await expect(mutations.updateTrades(['trade-1'], { instrument: 'NQ' })).rejects.toThrow('boom')
    })

    expect(queryClient.getQueryData(TABLE_KEY)).toEqual(tableData)
    expect(queryClient.getQueryData(emptyKey)).toBeUndefined()
    expect(queryClient.getQueryCache().find({ exact: true, queryKey: emptyKey })?.state.data).toBeUndefined()
    const restoredTable = queryClient.getQueryCache().find({ exact: true, queryKey: TABLE_KEY })
    expect(restoredTable?.state.data).toEqual(tableData)
    await act(async () => root.unmount())
  })
})