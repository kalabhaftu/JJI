// Unified Mock Data Store for Demo Mode
// Decouples massive mock data objects from production client components/hooks

import {
  calculateDayOfWeekPerformance,
  calculateOutcomeDistribution,
  calculateEquityCurve,
  calculateNetDailyPnl,
  calculateDailyCumulativePnl,
  calculateAccountBalanceChart,
  calculatePnlByStrategy,
  calculatePnlByInstrument,
  calculateWinRateByStrategy,
  calculateTradeDurationPerformance,
  calculateWeekdayPnl,
  calculatePerformanceScoreResult,
  calculateSessionAnalysis,
  calculateAccountProgression,
  calculateTagPerformance,
  calculateTimeOfDayPerformance,
  calculateDisciplineAnalytics,
} from '@/lib/dashboard/analytics-calculations'
import { calculateBalanceInfo } from '@/lib/utils/balance-calculator'
import { formatCalendarData, calculateStatistics } from '@/lib/utils'

export const MOCK_ACCOUNTS = [
  {
    id: 'mock-acc-1',
    number: 'DEMO-123',
    name: 'Demo Account',
    propfirm: '',
    broker: 'Mock Broker',
    startingBalance: 100000,
    calculatedEquity: 105432,
    pnl: 5432,
    currentBalance: 105432,
    currentEquity: 105432,
    status: 'active',
    createdAt: new Date().toISOString(),
    userId: 'demo-user',
    groupId: null,
    group: null,
    accountType: 'live',
    displayName: 'Demo Account (DEMO-123)',
    tradeCount: 80,
    owner: null,
    isOwner: true,
    currentPhase: null
  },
  {
    id: 'mock-propfirm-1',
    number: 'FTMO-PHASE-1',
    name: 'Demo Prop Firm Account',
    propfirm: 'FTMO',
    broker: 'Mock Broker',
    startingBalance: 100000,
    calculatedEquity: 105432,
    pnl: 5432,
    currentBalance: 105432,
    currentEquity: 105432,
    status: 'active',
    createdAt: new Date().toISOString(),
    userId: 'demo-user',
    groupId: null,
    group: null,
    accountType: 'prop-firm',
    displayName: 'Demo Prop Firm Account (Phase 1)',
    tradeCount: 80,
    owner: null,
    isOwner: true,
    currentPhase: 1,
    phaseAccountNumber: 'FTMO-PHASE-1',
    isArchived: false,
    currentPhaseDetails: {
      phaseNumber: 1,
      status: 'active',
      phaseId: 'FTMO-PHASE-1',
      masterAccountId: 'mock-propfirm-1',
      masterAccountName: 'Demo Prop Firm Account',
      evaluationType: 'Two Step'
    }
  },
  {
    id: 'mock-propfirm-failed',
    number: 'OLD-CHALLENGE',
    name: 'Failed Challenge (Old)',
    propfirm: 'MyForexFunds',
    broker: 'Mock Broker',
    startingBalance: 50000,
    calculatedEquity: 44000,
    pnl: -6000,
    currentBalance: 44000,
    currentEquity: 44000,
    status: 'failed',
    createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    userId: 'demo-user',
    groupId: null,
    group: null,
    accountType: 'prop-firm',
    displayName: 'Failed Challenge (Old) (Blown)',
    tradeCount: 20,
    owner: null,
    isOwner: true,
    currentPhase: 1,
    phaseAccountNumber: 'OLD-CHALLENGE',
    isArchived: false,
    currentPhaseDetails: {
      phaseNumber: 1,
      status: 'failed',
      phaseId: 'OLD-CHALLENGE',
      masterAccountId: 'mock-propfirm-failed',
      masterAccountName: 'Failed Challenge (Old)',
      evaluationType: 'Two Step'
    }
  }
];

export const MOCK_LIVE_ACCOUNT_DETAILS = {
  id: 'mock-acc-1',
  number: 'DEMO-123',
  name: 'Demo Account',
  broker: 'Mock Broker',
  displayName: 'Demo Account (DEMO-123)',
  startingBalance: 100000,
  currentEquity: 105432,
  status: 'active',
  accountType: 'live',
  tradeCount: 80,
  profitLoss: 5432,
  createdAt: new Date().toISOString()
};

export function getMockPropFirmDetails(isFailed: boolean) {
  if (isFailed) {
    return {
      account: {
        id: 'mock-propfirm-failed',
        accountName: 'Failed Challenge (Old)',
        propFirmName: 'MyForexFunds',
        accountSize: 50000,
        evaluationType: 'Two Step',
        currentPhase: {
          id: 'mock-phase-failed',
          phaseNumber: 1,
          phaseId: 'OLD-CHALLENGE',
          status: 'failed',
          profitTargetPercent: 8,
          dailyDrawdownPercent: 5,
          maxDrawdownPercent: 10,
          maxDrawdownType: 'balance',
          minTradingDays: 5,
          timeLimitDays: null,
          consistencyRulePercent: 0,
          profitSplitPercent: 75,
          payoutCycleDays: 30,
          startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        status: 'failed',
        phases: [
          {
            id: 'mock-phase-failed',
            phaseNumber: 1,
            phaseId: 'OLD-CHALLENGE',
            status: 'failed',
            profitTargetPercent: 8,
            dailyDrawdownPercent: 5,
            maxDrawdownPercent: 10,
            maxDrawdownType: 'balance',
            minTradingDays: 5,
            timeLimitDays: null,
            consistencyRulePercent: 0,
            profitSplitPercent: 75,
            payoutCycleDays: 30,
            startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        currentPnL: -6000,
        currentGrossPnL: -5850,
        currentNetPnL: -6000,
        currentBalance: 44000,
        currentEquity: 44000,
        dailyDrawdownRemaining: 0,
        maxDrawdownRemaining: 0,
        profitTargetProgress: 0,
        lastUpdated: new Date().toISOString()
      },
      drawdown: {
        dailyDrawdownRemaining: 0,
        maxDrawdownRemaining: 0,
        dailyStartBalance: 50000,
        highestEquity: 51200,
        currentEquity: 44000,
        isBreached: true,
        breachType: 'max_drawdown'
      }
    };
  }

  return {
    account: {
      id: 'mock-propfirm-1',
      accountName: 'Demo Prop Firm Account',
      propFirmName: 'FTMO',
      accountSize: 100000,
      evaluationType: 'Two Step',
      currentPhase: {
        id: 'mock-phase-1',
        phaseNumber: 1,
        phaseId: 'FTMO-PHASE-1',
        status: 'active',
        profitTargetPercent: 10,
        dailyDrawdownPercent: 5,
        maxDrawdownPercent: 10,
        maxDrawdownType: 'balance',
        minTradingDays: 4,
        timeLimitDays: null,
        consistencyRulePercent: 0,
        profitSplitPercent: 80,
        payoutCycleDays: 14,
        startDate: new Date().toISOString(),
        endDate: null
      },
      status: 'active',
      phases: [
        {
          id: 'mock-phase-1',
          phaseNumber: 1,
          phaseId: 'FTMO-PHASE-1',
          status: 'active',
          profitTargetPercent: 10,
          dailyDrawdownPercent: 5,
          maxDrawdownPercent: 10,
          maxDrawdownType: 'balance',
          minTradingDays: 4,
          timeLimitDays: null,
          consistencyRulePercent: 0,
          profitSplitPercent: 80,
          payoutCycleDays: 14,
          startDate: new Date().toISOString(),
          endDate: null
        }
      ],
      currentPnL: 5432,
      currentGrossPnL: 5600,
      currentNetPnL: 5432,
      currentBalance: 105432,
      currentEquity: 105432,
      dailyDrawdownRemaining: 4568,
      maxDrawdownRemaining: 9568,
      profitTargetProgress: 54.32,
      lastUpdated: new Date().toISOString()
    },
    drawdown: {
      dailyDrawdownRemaining: 4568,
      maxDrawdownRemaining: 9568,
      dailyStartBalance: 100000,
      highestEquity: 105432,
      currentEquity: 105432,
      isBreached: false
    }
  };
}

const MOCK_PROP_FIRM_DETAILS = getMockPropFirmDetails(false);

const MOCK_PROP_FIRM_SETTINGS = {
  id: 'mock-propfirm-1',
  number: 'FTMO-PHASE-1',
  name: 'Demo Prop Firm Account',
  propfirm: 'FTMO',
  status: 'active',
  currentEquity: 105432,
  currentBalance: 105432,
  startingBalance: 100000,
  dailyDrawdownLimit: 5000,
  maxDrawdownLimit: 10000,
  profitTarget: 10000,
  timezone: 'UTC',
  dailyResetTime: '17:00',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isArchived: false,
  notes: ''
};

export const MOCK_PAYOUT_ELIGIBILITY = {
  isEligible: true,
  daysSinceFunded: 15,
  daysSinceLastPayout: 15,
  netProfitSinceLastPayout: 5432,
  minDaysRequired: 14,
  profitSplitAmount: 4345.60,
  blockers: []
};

export const MOCK_USER_PROFILE = {
  id: 'demo-user',
  email: 'demo@justjournalit.com',
  username: 'demo_trader',
  firstName: 'Demo',
  lastName: 'Trader',
  timezone: 'America/New_York',
  use24HourFormat: true,
  isFirstConnection: false,
  breakEvenThreshold: 1.5,
  pnlDisplayMode: 'net',
  aiInsightsEnabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const MOCK_SUBSCRIPTION = {
  id: 'sub-mock',
  userId: 'demo-user',
  status: 'active',
  priceId: 'premium-monthly',
  tier: 'premium',
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancelAtPeriodEnd: false
};

export const MOCK_WEBHOOK_TOKEN = {
  token: 'demo_webhook_token_xyz123'
};

export const MOCK_GOALS = [
  {
    id: 'mock-goal-1',
    userId: 'demo-user',
    title: 'Maintain 50% Win Rate',
    description: 'Keep the win rate above 50% for this month.',
    metric: 'winRate',
    targetValue: 50,
    currentValue: 55,
    period: 'monthly',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-goal-2',
    userId: 'demo-user',
    title: 'Profit Target $5,000',
    description: 'Reach $5,000 net profit.',
    metric: 'pnl',
    targetValue: 5000,
    currentValue: 5432,
    period: 'monthly',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
    status: 'completed',
    createdAt: new Date().toISOString()
  }
];

export function getMockTradesList() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const prevDaysInMonth = new Date(prevYear, prevMonth + 1, 0).getDate()

  const instruments = ['EURUSD', 'NQ100', 'XAUUSD', 'GBPUSD', 'SPX500']
  const strategies = ['EMA Cross', 'ICT Silver Bullet', 'SMT Divergence', 'Liquidity Sweep', 'Order Block']
  const rules = ['Stop Loss Set', 'Risk Managed', 'Plan Followed', 'No FOMO', 'New York Session Only']
  const tags = ['Trend', 'Reversal', 'Breakout', 'Range', 'Session Start']
  const sides = ['LONG', 'SHORT']

  const instrumentPrices: Record<string, number> = {
    EURUSD: 1.0850,
    NQ100: 18500.0,
    XAUUSD: 2350.0,
    GBPUSD: 1.2720,
    SPX500: 5300.0
  }

  // Generate 80 trades distributed across current and previous month
  const trades = Array.from({ length: 80 }).map((_, i) => {
    let entryTime: Date
    if (i < 65) {
      const maxDay = Math.min(daysInMonth, 28)
      const day = 1 + Math.floor((i / 65) * maxDay)
      entryTime = new Date(year, month, day)
    } else {
      const idx = i - 65
      const day = Math.max(1, prevDaysInMonth - 15 + idx)
      entryTime = new Date(prevYear, prevMonth, day)
    }

    const accountChoice = i % 5 === 0 
      ? 'failed-prop' 
      : (i % 3 === 0 ? 'active-prop' : 'live')

    const accountId = accountChoice === 'failed-prop' 
      ? 'mock-propfirm-failed' 
      : (accountChoice === 'active-prop' ? 'mock-propfirm-1' : 'mock-acc-1')

    const accountNumber = accountChoice === 'failed-prop'
      ? 'OLD-CHALLENGE'
      : (accountChoice === 'active-prop' ? 'FTMO-PHASE-1' : 'DEMO-123')

    const isWin = accountChoice === 'failed-prop'
      ? Math.random() > 0.75
      : Math.random() > 0.45

    const pnl = isWin 
      ? Math.floor(150 + Math.random() * 500) 
      : (accountChoice === 'failed-prop'
          ? -Math.floor(300 + Math.random() * 800)
          : -Math.floor(100 + Math.random() * 350))

    const quantity = Math.floor((1 + Math.random() * 4) * 10) / 10
    const commission = -Math.floor((1.5 + Math.random() * 2) * quantity * 100) / 100
    const netPnl = pnl + commission
    const durationMin = Math.floor(10 + Math.random() * 240)

    entryTime.setHours(8 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0)
    const exitTime = new Date(entryTime.getTime() + durationMin * 60 * 1000)

    const instrument = instruments[i % instruments.length] || 'NQ'
    const basePrice = instrumentPrices[instrument] || 100
    const diffPercent = (pnl / 100000)
    const entryPriceNum = basePrice * (1 + (Math.random() - 0.5) * 0.01)
    const closePriceNum = entryPriceNum * (1 + (sides[Math.floor(Math.random() * 2)] === 'LONG' ? 1 : -1) * diffPercent)
    
    const tradeSide = sides[Math.floor(Math.random() * 2)]
    const tradeInstrument = instruments[i % instruments.length]
    const currentSetup = strategies[i % strategies.length]
    const isRuleBroken = Math.random() > 0.9

    return {
      id: `demo-trade-${i}`,
      accountNumber,
      accountId,
      phaseAccountId: accountId,
      instrument: tradeInstrument,
      side: tradeSide,
      quantity,
      entryPrice: entryPriceNum.toFixed(tradeInstrument === 'XAUUSD' || tradeInstrument === 'NQ100' || tradeInstrument === 'SPX500' ? 2 : 5),
      closePrice: closePriceNum.toFixed(tradeInstrument === 'XAUUSD' || tradeInstrument === 'NQ100' || tradeInstrument === 'SPX500' ? 2 : 5),
      entryPriceValue: entryPriceNum,
      closePriceValue: closePriceNum,
      pnl,
      commission,
      netPnl,
      timeInPosition: durationMin * 60,
      entryDate: entryTime.toISOString(),
      closeDate: exitTime.toISOString(),
      entryTime,
      exitTime,
      status: 'Closed',
      ruleBroken: isRuleBroken,
      selectedRules: [rules[i % rules.length], rules[(i + 1) % rules.length]],
      tags: [tags[i % tags.length]],
      setup: currentSetup,
      tradingModel: currentSetup,
      TradingModel: { id: `tm-${i % strategies.length}`, name: currentSetup }
    }
  })

  trades.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
  return trades
}

export function getMockReportStats(): any {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const equityCurve = []
  let currentBalance = 100000
  equityCurve.push({ date: new Date(year, month, 1).toLocaleDateString(), balance: currentBalance, pnl: 0 })
  for (let i = 2; i <= 28; i++) {
    const isWin = Math.random() > 0.45
    const pnl = isWin ? Math.floor(150 + Math.random() * 800) : -Math.floor(100 + Math.random() * 350)
    currentBalance += pnl
    equityCurve.push({
      date: new Date(year, month, i).toLocaleDateString(),
      balance: currentBalance,
      pnl: pnl
    })
  }

  const COLORS = {
    bullish: 'green',
    bearish: 'red',
  }

  return {
    tradingActivity: {
      totalTrades: 80,
      winRate: '55.0',
      avgTradesPerMonth: 80,
      tradingDaysActive: 20,
      mostTradedDay: 'Tuesday',
      mostProfitableDay: 'Wednesday',
      mostProfitablePair: 'NQ100',
      mostLosingDay: 'Friday',
      mostLosingPair: 'EURUSD'
    },
    psychMetrics: {
      longestWinStreak: 8,
      longestLoseStreak: 4,
      avgWin: '450.00',
      avgLoss: '-220.00',
      totalNetPnL: 5432,
      expectancy: '67.90',
      profitFactor: '1.58',
      avgHoldingTime: '2h 15m',
      maxDrawdown: '1.20%',
      peakEquity: '106200.00',
      rrEfficiency: '75%',
      consistencyScore: '82%',
      recoveryFactor: '4.53',
      totalRMultiple: '12.4R',
      sharpeRatio: '2.10',
      sortinoRatio: '3.45',
      calmarRatio: '4.50'
    },
    sessionPerformance: {
      'New York': {
        name: 'New York',
        range: '13:00 - 22:00 UTC',
        trades: 45,
        wins: 26,
        pnl: 3850,
        totalHoldMs: 45 * 2.2 * 60 * 60 * 1000,
        peak: 4200,
        maxDD: 850
      },
      'London': {
        name: 'London',
        range: '08:00 - 17:00 UTC',
        trades: 25,
        wins: 14,
        pnl: 1820,
        totalHoldMs: 25 * 1.8 * 60 * 60 * 1000,
        peak: 2100,
        maxDD: 450
      },
      'Asia': {
        name: 'Asia',
        range: '00:00 - 09:00 UTC',
        trades: 10,
        wins: 4,
        pnl: -238,
        totalHoldMs: 10 * 3.5 * 60 * 60 * 1000,
        peak: 150,
        maxDD: 500
      }
    },
    rMultipleDistribution: {
      '<-1R': 2,
      '-1R to 0R': 34,
      '0R to 1R': 5,
      '1R to 2R': 22,
      '2R to 3R': 12,
      '>3R': 5
    },
    rMultipleDataQuality: {
      totalTrades: 80,
      tradesWithStopLoss: 78,
      percentageComplete: 97.5
    },
    chartData: {
      equityCurve: equityCurve,
      outcomeDistribution: [
        { name: 'Wins', value: 44, color: COLORS.bullish },
        { name: 'Losses', value: 36, color: COLORS.bearish }
      ],
      dayOfWeekPerformance: [
        { name: 'Mon', pnl: 450 },
        { name: 'Tue', pnl: 1200 },
        { name: 'Wed', pnl: 2150 },
        { name: 'Thu', pnl: 1850 },
        { name: 'Fri', pnl: -218 }
      ]
    },
    filteredTrades: [],
    filterOptions: {
      symbols: ['EURUSD', 'NQ100', 'XAUUSD', 'GBPUSD', 'SPX500'],
      symbolsWithMetadata: [
        { symbol: 'EURUSD', count: 20 },
        { symbol: 'NQ100', count: 18 },
        { symbol: 'XAUUSD', count: 15 },
        { symbol: 'GBPUSD', count: 15 },
        { symbol: 'SPX500', count: 12 }
      ],
      sessions: ['New York', 'London', 'Asia'],
      outcomes: [
        { value: 'WIN', label: 'Win' },
        { value: 'LOSS', label: 'Loss' },
        { value: 'BREAKEVEN', label: 'Breakeven' }
      ],
      strategies: [
        { id: 'tm-1', name: 'EMA Cross' },
        { id: 'tm-2', name: 'ICT Silver Bullet' },
        { id: 'tm-3', name: 'SMT Divergence' },
        { id: 'tm-4', name: 'Liquidity Sweep' },
        { id: 'tm-5', name: 'Order Block' }
      ]
    }
  }
}

export const MOCK_NOTIFICATIONS = [
  {
    id: 'mock-notif-1',
    userId: 'demo-user',
    type: 'PHASE_TRANSITION_PENDING',
    title: 'Phase 1 Passed!',
    message: 'Congratulations! You have passed Phase 1 of your challenge. Ready to transition to Phase 2.',
    isRead: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-notif-2',
    userId: 'demo-user',
    type: 'WEEKLY_PERFORMANCE',
    title: 'Weekly Review Ready',
    message: 'Your AI trading journal analysis for the last week is ready for review.',
    isRead: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-notif-3',
    userId: 'demo-user',
    type: 'RISK_DAILY_LOSS_80',
    title: 'Risk Warning (80%)',
    message: 'You have reached 80% of your maximum daily loss limit on DEMO-123. Trade carefully.',
    isRead: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
]

export function getMockDemoData() {
  const trades = getMockTradesList()

  // Format calendarData and calculate statistics
  const calendarData = formatCalendarData(trades as any, MOCK_ACCOUNTS as any, 'UTC')
  const stats = calculateStatistics(trades as any, MOCK_ACCOUNTS as any, undefined, 10)

  // Calculate widgets
  const widgets = {
    equityCurve: calculateEquityCurve(trades as any),
    netDailyPnl: calculateNetDailyPnl(trades as any, 10),
    dailyCumulativePnl: calculateDailyCumulativePnl(trades as any, 10),
    outcomeDistribution: calculateOutcomeDistribution(trades as any, 10),
    dayOfWeekPerformance: calculateDayOfWeekPerformance(trades as any, 10),
    accountBalanceChart: calculateAccountBalanceChart(trades as any, MOCK_ACCOUNTS as any, 10),
    pnlByStrategy: calculatePnlByStrategy(trades as any, 10),
    pnlByInstrument: calculatePnlByInstrument(trades as any, 10),
    winRateByStrategy: calculateWinRateByStrategy(trades as any, 10),
    tradeDurationPerformance: calculateTradeDurationPerformance(trades as any, 10),
    weekdayPnl: calculateWeekdayPnl(trades as any, 10),
    performanceScore: calculatePerformanceScoreResult(trades as any, 10),
    sessionAnalysis: calculateSessionAnalysis(trades as any, 10),
    accountProgression: calculateAccountProgression(trades as any, MOCK_ACCOUNTS as any, 10),
    tagPerformance: calculateTagPerformance(trades as any, 10),
    timeOfDayPerformance: calculateTimeOfDayPerformance(trades as any, 10),
    disciplineAnalytics: calculateDisciplineAnalytics(trades as any, 10),
    calendarData: calendarData,
    accountBalancePnl: calculateBalanceInfo(MOCK_ACCOUNTS as any, trades as any, [], { pnlDisplayMode: 'net' }),
  }

  return {
    trades,
    total: trades.length,
    statistics: stats,
    calendarData,
    widgets
  }
}

