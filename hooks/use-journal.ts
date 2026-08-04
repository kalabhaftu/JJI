import { useQuery } from '@tanstack/react-query'
import { type InferSelectModel } from 'drizzle-orm'
import { Trade as schemaTrade } from '@/lib/db/schema'

type Trade = InferSelectModel<typeof schemaTrade>
import { useData } from '@/context/data-provider'
import { apiRequestData, ApiClientError } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
import { reportClientError } from '@/lib/observability/report-error'

interface JournalResponse {
  trades: any[]
  total: number
  statistics: any | null
}

interface DemoJournalResponse {
  trades: any[]
  totalCount: number
  statistics: any | null
}

type JournalQueryData = JournalResponse | DemoJournalResponse

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
    limit = 21,
    search = '',
    tradeDate = '',
    filterBy = 'all',
    selectedTagIds = [],
    accountNumbers = []
  } = params

  const dataContext = useData()
  const isDemoMode = !!dataContext?.isDemoMode
  const scope = useQueryScope()

  const queryParams = new URLSearchParams()
  const normalizedSearch = search.trim()
  const exactDateMatch = normalizedSearch.match(/^(\d{4}-\d{2}-\d{2})$/)
  const normalizedTradeDate = tradeDate.trim()
  

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


  queryParams.append('includeStats', 'true')
  queryParams.append('includeCalendar', 'false')
  queryParams.append('groupByExecution', 'true')

  const url = isDemoMode ? null : `/api/v1/trades?${queryParams.toString()}`

  const query = useQuery<JournalQueryData>({
    queryKey: queryKeys.journal(scope, {
      demo: isDemoMode,
      page,
      limit,
      search,
      tradeDate,
      filterBy,
      selectedTagIds,
      accountNumbers,
    }),
    queryFn: async ({ signal }) => {
      if (isDemoMode) {
        const { getDemoJournalData } = await import('@/lib/demo/journal-data')
        return getDemoJournalData({ page, limit, search, tradeDate, filterBy, selectedTagIds })
      }
      try {
        return await apiRequestData<JournalResponse>(url!, { signal, operation: 'load-journal-trades' })
      } catch (error) {
        if (!(error instanceof ApiClientError && error.kind === 'offline')) {
          reportClientError(error, { operation: 'load-journal-trades', route: url! })
        }
        throw error
      }
    },
    enabled: isScopeReady(scope),
    placeholderData: (previous) => previous,
  })

  const { data, isLoading, error } = query

  const totalCount =
    data && 'total' in data
      ? data.total || 0
      : data?.totalCount || 0

  return {
    trades: (data?.trades as Trade[]) || [],
    totalCount,
    statistics: data?.statistics || null,
    isLoading,
    isError: error,
    refetch: () => query.refetch()
  }
}
