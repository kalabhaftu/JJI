import useSWR from 'swr'
import { type InferSelectModel } from 'drizzle-orm'
import { Trade as schemaTrade } from '@/lib/db/schema'

type Trade = InferSelectModel<typeof schemaTrade>
import { useData } from '@/context/data-provider'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export interface UseJournalParams {
  page?: number
  limit?: number
  search?: string
  tradeDate?: string
  filterBy?: 'all' | 'wins' | 'losses' | 'breakeven' | 'buys' | 'sells'
  selectedTagIds?: string[]
  accountNumbers?: string[]
}

export function useJournal(params: UseJournalParams) {
  const {
    page = 1,
    limit = 21, // ITEMS_PER_PAGE in journal-client
    search = '',
    tradeDate = '',
    filterBy = 'all',
    selectedTagIds = [],
    accountNumbers = []
  } = params

  const dataContext = useData()
  const isDemoMode = !!dataContext?.isDemoMode

  const queryParams = new URLSearchParams()
  const normalizedSearch = search.trim()
  const exactDateMatch = normalizedSearch.match(/^(\d{4}-\d{2}-\d{2})$/)
  const normalizedTradeDate = tradeDate.trim()
  
  // Pagination via offset since /v1/trades leverages pageLimit & pageOffset
  queryParams.append('pageLimit', limit.toString())
  queryParams.append('pageOffset', ((page - 1) * limit).toString())
  
  if (normalizedTradeDate) {
    queryParams.append('tradeDate', normalizedTradeDate)
  } else if (exactDateMatch && exactDateMatch[1]) {
    queryParams.append('tradeDate', exactDateMatch[1])
  } else if (normalizedSearch) {
    queryParams.append('search', normalizedSearch)
  }
  
  if (filterBy === 'wins') {
    queryParams.append('outcome', 'win')
  } else if (filterBy === 'losses') {
    queryParams.append('outcome', 'loss')
  } else if (filterBy === 'breakeven') {
    queryParams.append('outcome', 'breakeven')
  }

  if (filterBy === 'buys') {
    queryParams.append('side', 'BUY')
  } else if (filterBy === 'sells') {
    queryParams.append('side', 'SELL')
  }

  if (selectedTagIds.length > 0) {
    queryParams.append('tags', selectedTagIds.join(','))
  }

  if (accountNumbers.length > 0) {
    queryParams.append('accounts', accountNumbers.join(','))
  }

  // Only ask for trade array, no need to recalc huge stats arrays if the Journal doesn't use all of them
  // Actually Journal uses its own stats logic locally but to do that we need the aggregated stats from backend
  // because we are lazy loading! Let's request includeStats=true
  queryParams.append('includeStats', 'true')
  queryParams.append('includeCalendar', 'false')
  queryParams.append('groupByExecution', 'true')

  const url = isDemoMode ? null : `/api/v1/trades?${queryParams.toString()}`

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    keepPreviousData: true,
  })

  const demoKey = isDemoMode
    ? ['demo-journal', page, limit, search, tradeDate, filterBy, selectedTagIds.join(',')]
    : null
  const { data: demoData, isLoading: isDemoLoading } = useSWR(demoKey, async () => {
    const { getDemoJournalData } = await import('@/lib/demo/journal-data')
    return getDemoJournalData({ page, limit, search, tradeDate, filterBy, selectedTagIds })
  })

  if (isDemoMode) {
    return {
      trades: (demoData?.trades as any[]) || [],
      totalCount: demoData?.totalCount || 0,
      statistics: demoData?.statistics || null,
      isLoading: isDemoLoading,
      isError: null,
      refetch: async () => undefined,
    }
  }

  return {
    trades: (data?.trades as Trade[]) || [],
    totalCount: data?.total || 0,
    statistics: data?.statistics || null,
    isLoading,
    isError: error,
    refetch: mutate
  }
}
