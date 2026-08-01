import type { ReactNode } from 'react'

export type WidgetType =
  | 'calendarAdvanced'
  | 'calendarMini'
  | 'calendarHeatmap'
  | 'timeProfitScatter'
  | 'excursionScatter'
  | 'recentTrades'
  | 'accountBalancePnl'
  | 'tradeWinRate'
  | 'dayWinRate'
  | 'profitFactor'
  | 'avgWinLoss'
  | 'sessionAnalysis'
  | 'netDailyPnL'
  | 'dailyCumulativePnL'
  | 'accountBalanceChart'
  | 'weekdayPnL'
  | 'tradeDurationPerformance'
  | 'performanceScore'
  | 'pnlByInstrument'
  | 'pnlByStrategy'
  | 'winRateByStrategy'
  | 'equityCurve'
  | 'outcomeDistribution'
  | 'dayOfWeekPerformance'
  | 'drawdown'
  | 'performanceSummary'
  | 'streakKpi'
  | 'accountProgression'
  | 'tagPerformance'
  | 'timeOfDayPerformance'
  | 'disciplineAnalytics'
  | 'propFirmObjectivesToday'
  | 'propFirmAccountStatistics'
  | 'propFirmGrowthCurve'
export type WidgetSize = 'tiny' | 'small' | 'small-long' | 'medium' | 'large' | 'extra-large' | 'kpi'

export type WidgetSurfaceState = 'loading' | 'ready' | 'empty' | 'error'

export interface WidgetDataState<TData> {
  data: TData
  isLoading: boolean
  error: Error | string | null
}

export interface WidgetSurfaceContract {
  title?: string
  actions?: ReactNode
  state?: WidgetSurfaceState
  mobileMinHeight?: number
  mobileSizing: 'content' | 'minimum'
  resizableAt: 'desktop' | 'desktop-tablet'
}

interface LayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export interface Widget extends LayoutItem {
  type: WidgetType
  size: WidgetSize
  static?: boolean
}

export interface Layouts {
  desktop: Widget[]
  mobile: Widget[]
}

interface LayoutState {
  layouts: Layouts
  activeLayout: 'desktop' | 'mobile'
} 
