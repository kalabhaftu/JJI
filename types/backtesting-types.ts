
export type BacktestDirection = 'BUY' | 'SELL'
export type BacktestOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN'
export type BacktestSession = 'ASIAN' | 'LONDON' | 'NEW_YORK'
export type BacktestModel = 'ICT_2022' | 'MSNR' | 'TTFM' | 'PRICE_ACTION' | 'SUPPLY_DEMAND' | 'SMART_MONEY' | 'CUSTOM'

export interface BacktestTrade {
  id: string
  
  pair: string // e.g., EUR/USD, NAS100, GOLD
  direction: BacktestDirection
  outcome: BacktestOutcome
  session: BacktestSession
  model: BacktestModel
  customModel?: string // For custom models
  
  riskRewardRatio: number // e.g., 1.5 for 1:1.5
  riskPoints: number // Distance from entry to stop loss in points/pips
  rewardPoints: number // Distance from entry to take profit/exit in points/pips
  entryPrice: number
  stopLoss: number
  takeProfit: number
  exitPrice: number
  pnl: number // Profit or Loss amount
  
  images: string[] // Array of image URLs
  cardPreviewImage?: string
  
  notes?: string
  dateExecuted: Date
  createdAt: Date
  updatedAt: Date
  
  tags?: string[]
  backtestDate?: Date // When the backtest was performed
}

export interface BacktestStats {
  totalBacktests: number
  winRate: number
  averageRR: number
  totalPnL: number
  bestTrade: number
  worstTrade: number
  winCount: number
  lossCount: number
  breakevenCount: number
}

interface BacktestFormData {
  pair: string
  direction: BacktestDirection
  session: BacktestSession
  model: BacktestModel
  customModel?: string
  
  entryPrice: number
  stopLoss: number
  takeProfit: number
  exitPrice: number
  
  outcome: BacktestOutcome
  notes?: string
  images?: File[]
  cardPreviewImage?: File
  tags?: string[]
}

