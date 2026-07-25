export interface BacktestingStats {
  netPnl: number
  tradeWinRate: number
  profitFactor: number
  dayWinRate: number
  avgWinTrade: number
  avgLossTrade: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winningDays: number
  totalDays: number
  maxDrawdown: number
  recoveryFactor: number
  consistency: number
  performanceScore: number
}

export interface BacktestingCalendarData {
  [date: string]: {
    pnl: number
    trades: number
    winRate: number
    isWinningDay: boolean
  }
}

export interface PerformanceScoreMetrics {
  winRate: number
  profitFactor: number
  avgWinLoss: number
  recoveryFactor: number
  maxDrawdown: number
  consistency: number
}

export interface BacktestingData {
  stats: BacktestingStats
  calendarData: BacktestingCalendarData
  performanceMetrics: PerformanceScoreMetrics
}
