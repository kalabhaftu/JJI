import { calculateStatistics } from '@/lib/utils'
import { getMockTradesList } from '@/lib/demo/mock-data'

interface DemoJournalFilters {
  page: number
  limit: number
  search: string
  tradeDate: string
  filterBy: 'all' | 'wins' | 'losses' | 'breakeven' | 'buys' | 'sells'
  selectedTagIds: string[]
}

export function getDemoJournalData(filters: DemoJournalFilters) {
  let trades = getMockTradesList()

  if (filters.tradeDate) {
    trades = trades.filter((trade) => trade.entryDate.startsWith(filters.tradeDate))
  }

  if (filters.filterBy === 'wins') trades = trades.filter((trade) => trade.pnl > 10)
  if (filters.filterBy === 'losses') trades = trades.filter((trade) => trade.pnl < -10)
  if (filters.filterBy === 'breakeven') trades = trades.filter((trade) => trade.pnl >= -10 && trade.pnl <= 10)
  if (filters.filterBy === 'buys') trades = trades.filter((trade) => trade.side === 'LONG' || trade.side === 'Buy')
  if (filters.filterBy === 'sells') trades = trades.filter((trade) => trade.side === 'SHORT' || trade.side === 'Sell')

  if (filters.selectedTagIds.length > 0) {
    trades = trades.filter((trade) =>
      trade.tags?.some((tag: string | undefined) => tag && filters.selectedTagIds.includes(tag)),
    )
  }

  const normalizedSearch = filters.search.trim().toLowerCase()
  if (normalizedSearch) {
    trades = trades.filter((trade: any) =>
      trade.instrument?.toLowerCase().includes(normalizedSearch) ||
      trade.setup?.toLowerCase().includes(normalizedSearch) ||
      trade.comment?.toLowerCase().includes(normalizedSearch),
    )
  }

  const accounts = [{
    id: 'mock-acc-1',
    number: 'DEMO-123',
    name: 'Demo Account',
    accountType: 'live' as const,
    startingBalance: 100000,
    balanceToDate: 105432,
    isArchived: false,
    status: 'active',
  }]

  trades.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
  const statistics = calculateStatistics(trades as any, accounts as any, undefined, 10)
  const offset = (filters.page - 1) * filters.limit

  return {
    trades: trades.slice(offset, offset + filters.limit),
    totalCount: trades.length,
    statistics,
  }
}
