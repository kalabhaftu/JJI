
import type { DatabaseRecord } from './api'

// Enums from Prisma schema
export type AccountStatus = 'active' | 'failed' | 'passed' | 'funded' | 'pending' | null
export type PhaseType = 'phase_1' | 'phase_2' | 'funded'
type PhaseStatus = 'active' | 'passed' | 'failed'
export type DrawdownType = 'absolute' | 'percent'
type DrawdownMode = 'static' | 'trailing'
type EvaluationType = 'one_step' | 'two_step'
export type BreachType = 'daily_drawdown' | 'max_drawdown'

export interface PropFirmAccount extends DatabaseRecord {
  number: string
  name?: string
  propfirm: string
  startingBalance: number
  status: AccountStatus
  userId: string
  
  dailyDrawdownAmount?: number
  dailyDrawdownType: DrawdownType
  maxDrawdownAmount?: number
  maxDrawdownType: DrawdownType
  drawdownModeMax: DrawdownMode
  
  evaluationType: EvaluationType
  timezone: string
  dailyResetTime: string
  
  ddIncludeOpenPnl: boolean
  progressionIncludeOpenPnl: boolean
  allowManualPhaseOverride: boolean
  
  profitSplitPercent?: number
  payoutCycleDays?: number
  minDaysToFirstPayout?: number
  payoutEligibilityMinProfit?: number
  resetOnPayout: boolean
  reduceBalanceByPayout: boolean
  fundedResetBalance?: number

  phases?: PhaseAccount[]
  currentPhase?: PhaseAccount
  breaches?: Breach[]
  dailyAnchors?: DailyAnchor[]
  recentEquitySnapshots?: EquitySnapshot[]
}

// PhaseAccount interface for the new MasterAccount/PhaseAccount system
export interface PhaseAccount {
  id: string
  masterAccountId: string
  phaseNumber: number
  phaseId: string | null
  status: 'active' | 'passed' | 'failed' | 'archived'

  profitTargetPercent: number
  dailyDrawdownPercent: number
  maxDrawdownPercent: number
  maxDrawdownType: string
  minTradingDays: number
  timeLimitDays: number | null
  consistencyRulePercent: number

  profitSplitPercent: number | null
  payoutCycleDays: number | null

  startDate: Date
  endDate: Date | null
}

export interface PropFirmTrade extends DatabaseRecord {
  accountNumber: string
  quantity: number
  instrument: string
  entryPrice: string
  closePrice: string
  entryDate: string
  closeDate: string
  pnl: number
  commission: number
  side?: string
  comment?: string
  userId: string
  
  phaseId?: string
  accountId?: string
  symbol?: string
  entryTime?: Date
  exitTime?: Date
  phaseAccountId?: string
  phaseAccount?: PhaseAccount
  
  phase?: PhaseAccount
  account?: PropFirmAccount
}

interface PropFirmPayout extends DatabaseRecord {
  accountId: string
  accountNumber: string
  
  amount: number // Will be mapped to amountRequested
  date: Date     // Will be mapped to requestedAt
  
  amountRequested?: number
  amountPaid?: number
  requestedAt?: Date
  paidAt?: Date
  notes?: string
  status: string
  
  account?: PropFirmAccount
}

export interface Breach extends DatabaseRecord {
  accountId: string
  phaseId?: string
  breachType: BreachType
  breachAmount: number
  breachThreshold: number
  equity: number
  breachTime: Date
  description?: string
  
  account?: PropFirmAccount
  phase?: PhaseAccount
}

export interface DailyAnchor extends DatabaseRecord {
  accountId: string
  date: Date
  anchorEquity: number
  computedAt: Date
  
  account?: PropFirmAccount
}

interface EquitySnapshot extends DatabaseRecord {
  accountId: string
  phaseId?: string
  timestamp: Date
  equity: number
  balance: number
  openPnl: number
  
  account?: PropFirmAccount
  phase?: PhaseAccount
}

interface AccountTransition extends DatabaseRecord {
  accountId: string
  fromPhaseId?: string
  toPhaseId?: string
  fromStatus?: AccountStatus
  toStatus?: AccountStatus
  reason?: string
  triggeredBy?: string
  transitionTime: Date
  metadata: Record<string, any>
  
  account?: PropFirmAccount
  fromPhase?: PhaseAccount
  toPhase?: PhaseAccount
}

export interface DrawdownCalculation {
  dailyDrawdownRemaining: number
  maxDrawdownRemaining: number
  currentEquity: number
  dailyStartBalance: number
  highestEquity: number
  isBreached: boolean
  breachType?: BreachType
  breachAmount?: number
}

export interface PhaseProgress {
  currentPhase: PhaseAccount
  profitProgress: number
  profitTarget?: number
  daysInPhase: number
  canProgress: boolean
  nextPhaseType?: PhaseType
}

interface PayoutEligibility {
  isEligible: boolean
  daysSinceFunded: number
  daysSinceLastPayout: number
  netProfitSinceLastPayout: number
  minDaysRequired: number
  minProfitRequired?: number
  blockers: string[]
  maxPayoutAmount?: number
  profitSplitAmount?: number
  nextEligibleDate?: Date
}

interface AccountDashboardData {
  account: PropFirmAccount
  currentPhase: PhaseAccount
  drawdown: DrawdownCalculation
  progress: PhaseProgress
  payoutEligibility?: PayoutEligibility
  recentTrades: PropFirmTrade[]
  equityChart: EquitySnapshot[]
  breaches: Breach[]
}

interface AccountSummary {
  id: string
  number: string
  name?: string
  status: AccountStatus
  currentPhase: PhaseType
  balance: number
  equity: number
  dailyDrawdownRemaining: number
  maxDrawdownRemaining: number
  profitTargetProgress: number
  nextPayoutDate?: Date
  actions: string[] // Available actions: 'view', 'addTrade', 'requestPayout', 'reset'
}

interface CreateAccountRequest {
  number: string
  name?: string
  propfirm: string
  startingBalance: number
  dailyDrawdownAmount?: number
  dailyDrawdownType: DrawdownType
  maxDrawdownAmount?: number
  maxDrawdownType: DrawdownType
  drawdownModeMax: DrawdownMode
  evaluationType: EvaluationType
  timezone: string
  dailyResetTime: string
  profitTarget?: number
}

interface UpdateAccountRequest extends Partial<CreateAccountRequest> {
  status?: AccountStatus
  ddIncludeOpenPnl?: boolean
  progressionIncludeOpenPnl?: boolean
  allowManualPhaseOverride?: boolean
}

interface CreateTradeRequest {
  accountId: string
  symbol: string
  side: 'long' | 'short'
  quantity: number
  entryPrice: number
  exitPrice?: number
  entryTime: Date
  exitTime?: Date
  fees?: number
  commission?: number
  strategy?: string
  comment?: string
  tags?: string[]
}

interface RequestPayoutRequest {
  accountId: string
  amountRequested: number
  notes?: string
}

interface ResetAccountRequest {
  accountId: string
  reason: string
  clearTrades?: boolean
}

interface AccountStatsResponse {
  account: PropFirmAccount
  phases: PhaseAccount[]
  totalTrades: number
  totalPnl: number
  winRate: number
  avgWin: number
  avgLoss: number
  maxDrawdownHit: number
  daysSinceStart: number
  currentStreak: number
}

export interface AccountFilter {
  status?: AccountStatus[]
  phaseType?: PhaseType[]
  propfirm?: string[]
  evaluationType?: EvaluationType[]
}

export interface TradeFilter {
  accountId?: string
  phaseId?: string
  symbol?: string[]
  strategy?: string[]
  side?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  pnlRange?: {
    min?: number
    max?: number
  }
}

interface DailyAnchorJob {
  accountId: string
  targetDate: Date
  timezone: string
  resetTime: string
}

interface BreachCheckJob {
  accountId: string
  phaseId: string
  currentEquity: number
  includeOpenPnl: boolean
}

interface PayoutEligibilityJob {
  accountId: string
  checkDate: Date
}

