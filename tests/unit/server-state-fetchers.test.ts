import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/lib/query/query-keys'
import type { QueryScope } from '@/lib/query/query-scope'

const useQuery = vi.hoisted(() => vi.fn((options) => options))
const apiRequestData = vi.hoisted(() => vi.fn())
const demoData = vi.hoisted(() => ({
  trades: [{ id: 'demo-trade' }],
  totalCount: 3,
  statistics: null,
}))
const useData = vi.hoisted(() => vi.fn())
const useQueryScope = vi.hoisted(() => vi.fn())
const isScopeReady = vi.hoisted(() => vi.fn())
const reportClientError = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-query', () => ({ useQuery }))
vi.mock('@/lib/api/client', () => ({ apiRequestData }))
vi.mock('@/lib/demo/journal-data', () => ({ getDemoJournalData: () => demoData }))
vi.mock('@/context/data-provider', () => ({ useData }))
vi.mock('@/lib/query/use-query-scope', () => ({ useQueryScope, isScopeReady }))
vi.mock('@/lib/observability/report-error', () => ({ reportClientError }))

vi.mock('swr', () => {
  throw new Error('use-journal must not import swr')
})

import { useJournal } from '@/hooks/use-journal'

const scope: QueryScope = { surface: 'authenticated', userId: 'user-1' }

function journalOptions() {
  return useQuery.mock.calls.at(-1)?.[0] as any
}

beforeEach(() => {
  vi.clearAllMocks()
  useQuery.mockImplementation((options) => options)
  useData.mockReturnValue({ isDemoMode: false })
  useQueryScope.mockReturnValue(scope)
  isScopeReady.mockReturnValue(true)
})

describe('useJournal query contract', () => {
  it('uses the scoped journal key and forwards signal + operation to the canonical client', async () => {
    apiRequestData.mockResolvedValue({ trades: [], total: 0, statistics: null })

    useJournal({
      page: 2,
      limit: 21,
      search: 'ES',
      tradeDate: '',
      filterBy: 'wins',
      selectedTagIds: ['a', 'b'],
      accountNumbers: ['1'],
    })
    const options = journalOptions()

    expect(options.queryKey).toEqual(
      queryKeys.journal(scope, {
        demo: false,
        page: 2,
        limit: 21,
        search: 'ES',
        tradeDate: '',
        filterBy: 'wins',
        selectedTagIds: ['a', 'b'],
        accountNumbers: ['1'],
      }),
    )

    const signal = new AbortController().signal
    await options.queryFn({ signal })

    expect(apiRequestData).toHaveBeenCalledWith(
      '/api/v1/trades?pageLimit=21&pageOffset=21&search=ES&outcome=win&tags=a%2Cb&accounts=1&includeStats=true&includeCalendar=false&groupByExecution=true',
      { signal, operation: 'load-journal-trades' },
    )
  })

  it('maps an exact-date search into the tradeDate query param', async () => {
    apiRequestData.mockResolvedValue({ trades: [], total: 0, statistics: null })

    useJournal({
      page: 1,
      search: '2026-08-04',
      filterBy: 'buys',
      selectedTagIds: [],
      accountNumbers: [],
    })
    const options = journalOptions()

    await options.queryFn({ signal: new AbortController().signal })

    expect(apiRequestData).toHaveBeenCalledWith(
      '/api/v1/trades?pageLimit=21&pageOffset=0&tradeDate=2026-08-04&side=BUY&includeStats=true&includeCalendar=false&groupByExecution=true',
      expect.objectContaining({ operation: 'load-journal-trades' }),
    )
  })

  it('serves demo fixtures without calling the API and marks the key', async () => {
    useData.mockReturnValue({ isDemoMode: true })

    useJournal({
      page: 1,
      search: '',
      filterBy: 'all',
      selectedTagIds: [],
      accountNumbers: [],
    })
    const options = journalOptions()

    await expect(options.queryFn({ signal: new AbortController().signal })).resolves.toBe(demoData)
    expect(options.queryKey).toEqual(
      queryKeys.journal(scope, {
        demo: true,
        page: 1,
        limit: 21,
        search: '',
        tradeDate: '',
        filterBy: 'all',
        selectedTagIds: [],
        accountNumbers: [],
      }),
    )
    expect(apiRequestData).not.toHaveBeenCalled()
  })

  it('respects scope readiness and keeps previous data during refetches', () => {
    isScopeReady.mockReturnValue(false)

    useJournal({})
    const options = journalOptions()

    expect(options.enabled).toBe(false)
    expect(options.placeholderData).toBeTypeOf('function')

    const previous = { trades: [{ id: 'stale' }], total: 1, statistics: null }
    expect(options.placeholderData(previous)).toBe(previous)
  })

  it('reports real-mode client errors before rethrowing', async () => {
    apiRequestData.mockRejectedValue(new Error('boom'))

    useJournal({ page: 1 })
    const options = journalOptions()

    await expect(options.queryFn({ signal: new AbortController().signal })).rejects.toThrow('boom')
    expect(reportClientError).toHaveBeenCalledWith(
      expect.any(Error),
      {
        operation: 'load-journal-trades',
        route: '/api/v1/trades?pageLimit=21&pageOffset=0&includeStats=true&includeCalendar=false&groupByExecution=true',
      },
    )
  })

  it('returns the journal contract bound to the query result, preserving demo totals', () => {
    const refetch = vi.fn()
    useQuery.mockReturnValue({
      data: { trades: [{ id: 't1' }], total: 12, statistics: { totalPnl: 1 } },
      isLoading: true,
      error: null,
      refetch,
    })

    const realResult = useJournal({}) as any
    expect(realResult.trades).toEqual([{ id: 't1' }])
    expect(realResult.totalCount).toBe(12)
    expect(realResult.statistics).toEqual({ totalPnl: 1 })
    expect(realResult.isLoading).toBe(true)
    expect(realResult.isError).toBeNull()
    realResult.refetch()
    expect(refetch).toHaveBeenCalled()

    useData.mockReturnValue({ isDemoMode: true })
    useQuery.mockReturnValue({
      data: demoData,
      isLoading: false,
      error: null,
      refetch,
    })

    const demoResult = useJournal({}) as any
    expect(demoResult.totalCount).toBe(3)
  })
})
