import type React from 'react'
import type { AccountType, DashboardTemplateType as DashboardLayoutType, PayoutType, TradeType } from '@/lib/db/schema'
import type { AccountFilterSettings } from '@/types/account-filter-settings'
import type {
  DataProviderDateRange as DateRange,
  DataProviderHourFilter as HourFilter,
  DataProviderPnlRange as PnlRange,
  DataProviderTimeRange as TimeRange,
  DataProviderWeekdayFilter as WeekdayFilter,
} from '@/hooks/use-data-provider-filter-state'

export type StatisticsProps = {
  breakEvenThreshold: number
  cumulativeFees: number
  cumulativePnl: number
  winningStreak: number
  winRate: number
  nbTrades: number
  nbBe: number
  nbWin: number
  nbLoss: number
  totalPositionTime: number
  averagePositionTime: string
  profitFactor: number
  grossLosses: number
  grossWin: number
  biggestWin: number
  biggestLoss: number
  averageWin: number
  averageLoss: number
  totalPayouts: number
  nbPayouts: number
  totalPnL: number
}

export type CalendarData = {
  [date: string]: {
    pnl: number
    tradeNumber: number
    longNumber: number
    shortNumber: number
    trades: TradeType[]
  }
}

export interface Account extends Omit<AccountType, 'payouts'> {
  payouts?: PayoutType[]
  balanceToDate?: number
  status?: string
  accountType?: 'live' | 'prop-firm'
  displayName?: string
  propfirm?: string
  currentPhaseDetails?: { masterAccountId?: string }
}

export interface DataContextType {
  isDemoMode?: boolean
  refreshTrades: () => Promise<void>
  refreshAllData: () => Promise<void>
  isPlusUser: () => boolean
  isLoading: boolean
  isLoadingAccountFilterSettings: boolean
  accountFilterSettings: AccountFilterSettings | null
  updateAccountFilterSettings: (newSettings: Partial<AccountFilterSettings>) => Promise<void>
  isMobile: boolean
  changeIsFirstConnection: (isFirstConnection: boolean) => void
  isFirstConnection: boolean
  setIsFirstConnection: (isFirstConnection: boolean) => void
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
  formattedTrades: TradeType[]
  instruments: string[]
  setInstruments: React.Dispatch<React.SetStateAction<string[]>>
  accountNumbers: string[]
  setAccountNumbers: React.Dispatch<React.SetStateAction<string[]>>
  dateRange: DateRange | undefined
  setDateRange: React.Dispatch<React.SetStateAction<DateRange | undefined>>
  pnlRange: PnlRange
  setPnlRange: React.Dispatch<React.SetStateAction<PnlRange>>
  timeRange: TimeRange
  setTimeRange: React.Dispatch<React.SetStateAction<TimeRange>>
  weekdayFilter: WeekdayFilter
  setWeekdayFilter: React.Dispatch<React.SetStateAction<WeekdayFilter>>
  hourFilter: HourFilter
  setHourFilter: React.Dispatch<React.SetStateAction<HourFilter>>
  statistics: StatisticsProps
  calendarData: CalendarData
  widgetData: Record<string, any> | null
  accounts: Account[]
  updateTrades: (tradeIds: string[], update: Partial<TradeType>) => Promise<void>
  appendTagsToTrades: (tradeIds: string[], tagIds: string[]) => Promise<void>
  groupTrades: (tradeIds: string[]) => Promise<void>
  ungroupTrades: (tradeIds: string[]) => Promise<void>
  deleteAccount: (account: Account) => Promise<void>
  saveAccount: (account: Account) => Promise<void>
  savePayout: (payout: PayoutType) => Promise<void>
  deletePayout: (payoutId: string) => Promise<void>
  saveDashboardLayout: (layout: DashboardLayoutType) => Promise<void>
}

export const EMPTY_STATISTICS: StatisticsProps = {
  breakEvenThreshold: 0, cumulativeFees: 0, cumulativePnl: 0, winningStreak: 0,
  winRate: 0, nbTrades: 0, nbBe: 0, nbWin: 0, nbLoss: 0, totalPositionTime: 0,
  averagePositionTime: '0s', profitFactor: 0, grossLosses: 0, grossWin: 0,
  biggestWin: 0, biggestLoss: 0, averageWin: 0, averageLoss: 0,
  totalPayouts: 0, nbPayouts: 0, totalPnL: 0,
}

export const EMPTY_CALENDAR_DATA: CalendarData = {}
