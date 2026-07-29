export interface PhaseTradeInput {
  pnl?: number | null
  commission?: number | null
  exitTime?: Date | string | null
  createdAt?: Date | string | null
}

export interface PhaseRulesInput {
  dailyDrawdownPercent: number
  maxDrawdownPercent: number
  maxDrawdownType?: string | null
  profitTargetPercent: number
  minTradingDays?: number | null
  timeLimitDays?: number | null
  startDate?: Date | string | null
  MasterAccount?: { accountSize?: number | null } | null
  masterAccount?: { accountSize?: number | null } | null
}

export interface DrawdownCalculation {
  currentEquity: number
  dailyStartBalance: number
  highWaterMark: number
  dailyDrawdownUsed: number
  dailyDrawdownLimit: number
  dailyDrawdownRemaining: number
  dailyDrawdownPercent: number
  maxDrawdownUsed: number
  maxDrawdownLimit: number
  maxDrawdownRemaining: number
  maxDrawdownPercent: number
  isBreached: boolean
  breachType?: 'daily_drawdown' | 'max_drawdown'
  breachAmount?: number
  breachTime?: Date
}

export interface PhaseProgress {
  currentPnL: number
  profitTargetAmount: number
  profitTargetRemaining: number
  profitTargetPercent: number
  tradingDaysCompleted: number
  minTradingDaysRequired: number
  isEligibleForAdvancement: boolean
  canPassPhase: boolean
  daysRemaining?: number
}

export interface PhaseRiskAlert {
  userId: string
  phaseAccountId: string
  riskType: 'daily_loss' | 'max_drawdown'
  currentPercentage: number
  metadata: {
    accountName: string
    currentBalance: number
    limit: number
    used: number
  }
}

export interface PhaseEvaluationResult {
  drawdown: DrawdownCalculation
  progress: PhaseProgress
  isFailed: boolean
  isPassed: boolean
  canAdvance: boolean
  nextAction: 'continue' | 'fail' | 'advance'
  alerts: PhaseRiskAlert[]
}

export interface PhaseMasterInput {
  accountSize: number
  userId: string
  accountName: string
}

export interface PhaseEvaluationMetrics {
  currentPnl: number
  currentEquity: number
  highWaterMark: number
  progress: PhaseProgress
}
