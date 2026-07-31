export type WidgetType =
  | 'calendarAdvanced'
  | 'calendarMini'
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
