import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryKeyPrefixes } from '@/lib/query/query-keys'

const apiRequest = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { updated: 1 } }))
vi.mock('@/lib/api/client', () => ({ apiRequest }))

import { useDataProviderTradeMutations } from '@/hooks/use-data-provider-trade-mutations'

type Mutations = ReturnType<typeof useDataProviderTradeMutations>

function Probe({ queryClient, capture }: { queryClient: any; capture: (value: Mutations) => void }) {
  capture(useDataProviderTradeMutations({ userId: 'user-1', queryClient }))
  return null
}

afterEach(() => vi.clearAllMocks())

describe('trade mutation query ownership', () => {
  it('patches and invalidates canonical authenticated trade queries', async () => {
    const queryClient = {
      getQueriesData: vi.fn().mockReturnValue([]),
      setQueriesData: vi.fn(),
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    }
    let mutations!: Mutations
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe, {
      queryClient,
      capture: (value) => { mutations = value },
    })))

    await act(async () => mutations.updateTrades(['trade-1'], { instrument: 'NQ' }))

    const prefix = queryKeyPrefixes.trades({ surface: 'authenticated', userId: 'user-1' })
    expect(queryClient.getQueriesData).toHaveBeenCalledWith({ queryKey: prefix })
    expect(queryClient.setQueriesData).toHaveBeenCalledWith({ queryKey: prefix }, expect.any(Function))
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: prefix })
    expect(queryClient.setQueriesData).not.toHaveBeenCalledWith({ queryKey: ['v1', 'trades'] }, expect.any(Function))
    await act(async () => root.unmount())
  })
})
