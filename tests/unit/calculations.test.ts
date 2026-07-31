import { describe, it, expect } from 'vitest'
import { calculateStatistics, groupTradesByExecution } from '@/lib/utils'
import { calculateMetricsFromTrades } from '@/lib/performance-score'
import { classifyOutcome } from '@/lib/metrics/outcome'
import type { TradeType as Trade } from '@/lib/db/schema/trades'

// Helper to create mock trades
function createMockTrade(overrides: Partial<Trade> = {}): Trade {
  // Generate unique entryId to prevent unwanted grouping
  const uniqueId = Math.random().toString(36).substring(7);
  return {
    id: `test-id-${uniqueId}`,
    accountNumber: 'TEST123',
    quantity: 1,
    entryId: `entry-${uniqueId}`,
    instrument: 'EURUSD',
    entryPrice: '1.1000' as any,
    closePrice: '1.1050' as any,
    entryDate: '2024-01-01T10:00:00Z',
    closeDate: '2024-01-01T11:00:00Z',
    pnl: 100,
    timeInPosition: 3600,
    userId: 'user-1',
    side: 'long',
    commission: 0,
    createdAt: new Date(),
    comment: null,
    groupId: null,
    cardPreviewImage: null,
    accountId: null,
    phaseAccountId: null,
    symbol: null,
    entryTime: new Date('2024-01-01T10:00:00Z'),
    exitTime: new Date('2024-01-01T11:00:00Z'),
    closeReason: null,
    stopLoss: null,
    takeProfit: null,
    tradingModel: null,
    tags: null,
    ...overrides,
  }
}

describe('Financial Calculations - Profit Factor', () => {
  it('should calculate profit factor correctly with wins and losses', () => {
    const trades = [
      createMockTrade({ pnl: 200, commission: 0 }), // Win
      createMockTrade({ pnl: 300, commission: 0 }), // Win
      createMockTrade({ pnl: -100, commission: 0 }), // Loss
      createMockTrade({ pnl: -50, commission: 0 }), // Loss
    ]

    // Gross profits: 500
    // Gross losses: 150
    // Profit Factor: 500 / 150 = 3.33
    const stats = calculateStatistics(trades, [])
    expect(stats.profitFactor).toBeCloseTo(3.33, 2)
  })

  it('should handle profit factor with only wins (no losses)', () => {
    const trades = [
      createMockTrade({ pnl: 100, commission: 0 }),
      createMockTrade({ pnl: 200, commission: 0 }),
    ]

    // No losses means infinite profit factor, but we should return a high number
    const stats = calculateStatistics(trades, [])
    expect(stats.profitFactor).toBeGreaterThan(0)
  })

  it('should handle profit factor with only losses (no wins)', () => {
    const trades = [
      createMockTrade({ pnl: -100, commission: 0 }),
      createMockTrade({ pnl: -200, commission: 0 }),
    ]

    const stats = calculateStatistics(trades, [])
    expect(stats.profitFactor).toBe(0)
  })

  it('should calculate profit factor from canonical trade.pnl values', () => {
    const trades = [
      createMockTrade({ pnl: 100, commission: 20 }),
      createMockTrade({ pnl: 200, commission: 30 }),
      createMockTrade({ pnl: -100, commission: 10 }),
    ]

    // Canonical model: trade.pnl is already the realized result used for outcomes/metrics.
    // Gross profits: 300
    // Gross losses: 100
    // Profit Factor: 300 / 100 = 3
    const stats = calculateStatistics(trades, [])
    expect(stats.profitFactor).toBeCloseTo(3.0, 2)
  })
})

describe('Financial Calculations - Win Rate', () => {
  it('should calculate win rate correctly', () => {
    const trades = [
      createMockTrade({ pnl: 100, commission: 0 }), // Win
      createMockTrade({ pnl: 200, commission: 0 }), // Win
      createMockTrade({ pnl: -100, commission: 0 }), // Loss
      createMockTrade({ pnl: 50, commission: 0 }), // Win
    ]

    // 3 wins out of 4 trades = 75%
    const stats = calculateStatistics(trades, [])
    expect(stats.winRate).toBe(75)
  })

  it('should exclude break-even trades from win rate calculation', () => {
    const trades = [
      createMockTrade({ pnl: 100, commission: 0 }), // Win
      createMockTrade({ pnl: 0, commission: 0 }), // Break-even (excluded)
      createMockTrade({ pnl: -100, commission: 0 }), // Loss
    ]

    // 1 win out of 2 tradable trades (excluding break-even) = 50%
    const stats = calculateStatistics(trades, [])
    expect(stats.winRate).toBe(50)
  })

  it('should calculate win rate from canonical trade.pnl values', () => {
    const trades = [
      createMockTrade({ pnl: 100, commission: 50 }),
      createMockTrade({ pnl: 30, commission: 30 }),
      createMockTrade({ pnl: -50, commission: 10 }),
      createMockTrade({ pnl: 200, commission: 50 }),
    ]

    // With threshold ±10: 3 wins (100, 30, 200), 1 loss (-50) => 75%
    const stats = calculateStatistics(trades, [])
    expect(stats.winRate).toBeCloseTo(75, 2)
  })

  it('should handle 100% win rate', () => {
    const trades = [
      createMockTrade({ pnl: 100, commission: 0 }),
      createMockTrade({ pnl: 200, commission: 0 }),
      createMockTrade({ pnl: 50, commission: 0 }),
    ]

    const stats = calculateStatistics(trades, [])
    expect(stats.winRate).toBe(100)
  })

  it('should handle 0% win rate', () => {
    const trades = [
      createMockTrade({ pnl: -100, commission: 0 }),
      createMockTrade({ pnl: -200, commission: 0 }),
    ]

    const stats = calculateStatistics(trades, [])
    expect(stats.winRate).toBe(0)
  })
})

describe('Financial Calculations - Average Win/Loss', () => {
  it('should calculate average win and average loss correctly', () => {
    const trades = [
      createMockTrade({ pnl: 200, commission: 0 }), // Win
      createMockTrade({ pnl: 400, commission: 0 }), // Win
      createMockTrade({ pnl: -100, commission: 0 }), // Loss
      createMockTrade({ pnl: -200, commission: 0 }), // Loss
    ]

    // Avg Win: (200 + 400) / 2 = 300
    // Avg Loss: (100 + 200) / 2 = 150
    const stats = calculateStatistics(trades, [])
    expect(stats.averageWin).toBe(300)
    expect(stats.averageLoss).toBe(150)
  })

  it('should calculate average win/loss from canonical trade.pnl values', () => {
    const trades = [
      createMockTrade({ pnl: 200, commission: 50 }),
      createMockTrade({ pnl: 400, commission: 100 }),
      createMockTrade({ pnl: -100, commission: 20 }),
    ]

    // Avg Win: (200 + 400) / 2 = 300
    // Avg Loss: 100
    const stats = calculateStatistics(trades, [])
    expect(stats.averageWin).toBe(300)
    expect(stats.averageLoss).toBe(100)
  })

  it('should handle trades with only wins', () => {
    const trades = [
      createMockTrade({ pnl: 100, commission: 0 }),
      createMockTrade({ pnl: 200, commission: 0 }),
    ]

    const stats = calculateStatistics(trades, [])
    expect(stats.averageWin).toBe(150)
    expect(stats.averageLoss).toBe(0)
  })

  it('should handle trades with only losses', () => {
    const trades = [
      createMockTrade({ pnl: -100, commission: 0 }),
      createMockTrade({ pnl: -300, commission: 0 }),
    ]

    const stats = calculateStatistics(trades, [])
    expect(stats.averageWin).toBe(0)
    expect(stats.averageLoss).toBe(200)
  })
})

describe('Financial Calculations - Net P&L', () => {
  it('should calculate total net P&L correctly', () => {
    const trades = [
      createMockTrade({ pnl: 200, commission: 0 }),
      createMockTrade({ pnl: -100, commission: 0 }),
      createMockTrade({ pnl: 300, commission: 0 }),
    ]

    // Total: 200 - 100 + 300 = 400
    const stats = calculateStatistics(trades, [])
    expect(stats.totalPnL).toBe(400)
  })

  it('should keep total P&L equal to canonical trade.pnl sum', () => {
    const trades = [
      createMockTrade({ pnl: 200, commission: 20 }),
      createMockTrade({ pnl: -100, commission: 10 }),
      createMockTrade({ pnl: 300, commission: 30 }),
    ]

    // Total: 200 - 100 + 300 = 400
    const stats = calculateStatistics(trades, [])
    expect(stats.totalPnL).toBe(400)
  })

  it('should handle negative total P&L', () => {
    const trades = [
      createMockTrade({ pnl: 100, commission: 0 }),
      createMockTrade({ pnl: -300, commission: 0 }),
      createMockTrade({ pnl: -200, commission: 0 }),
    ]

    // Total: 100 - 300 - 200 = -400
    const stats = calculateStatistics(trades, [])
    expect(stats.totalPnL).toBe(-400)
  })
})

describe('Financial Calculations - Trade Grouping (Partial Closes)', () => {
  it('should group trades by entryId for partial closes', () => {
    const trades = [
      createMockTrade({ entryId: 'E1', pnl: 50, quantity: 1 }),
      createMockTrade({ entryId: 'E1', pnl: 100, quantity: 1 }), // Partial close
      createMockTrade({ entryId: 'E2', pnl: 200, quantity: 2 }),
    ]

    const grouped = groupTradesByExecution(trades)
    
    // Should have 2 groups (E1 and E2)
    expect(grouped.length).toBe(2)
    
    // E1 group should have combined PnL of 150
    const e1Group = grouped.find(g => g.entryId === 'E1')
    expect(e1Group?.pnl).toBe(150)
  })

  it('should calculate win rate correctly with partial closes', () => {
    const trades = [
      createMockTrade({ entryId: 'E1', pnl: 50, commission: 0 }), // Part 1
      createMockTrade({ entryId: 'E1', pnl: 100, commission: 0 }), // Part 2 (combined: +150 Win)
      createMockTrade({ entryId: 'E2', pnl: -100, commission: 0 }), // Loss
    ]

    // After grouping: 1 win (E1: 150), 1 loss (E2: -100)
    // Win rate: 50%
    const stats = calculateStatistics(trades, [])
    expect(stats.winRate).toBe(50)
  })

  it('should preserve pnl totals while collapsing MatchTrader-style partial closes', () => {
    const trades = [
      createMockTrade({ entryId: 'W8176704479557188', pnl: 99.2 }),
      createMockTrade({ entryId: 'W8176704479552664', pnl: 45.13 }),
      createMockTrade({ entryId: 'W8176704479552664', pnl: 31.08 }),
      createMockTrade({ entryId: 'W8176704479552664', pnl: 26.57 }),
      createMockTrade({ entryId: 'W8176704479552664', pnl: 56.91 }),
      createMockTrade({ entryId: 'W8176704479517941', pnl: -11.56 }),
      createMockTrade({ entryId: 'W8176704479475945', pnl: -69.94 }),
      createMockTrade({ entryId: 'W8176704479430648', pnl: 18.15 }),
      createMockTrade({ entryId: 'W8176704479430648', pnl: 22.78 }),
      createMockTrade({ entryId: 'W8176704479430648', pnl: 69.9 }),
      createMockTrade({ entryId: 'W8176704479307794', pnl: -35.94 }),
      createMockTrade({ entryId: 'W8176704479304931', pnl: -10.56 }),
      createMockTrade({ entryId: 'W8176704479303950', pnl: -57.6 }),
      createMockTrade({ entryId: 'W8176704479184871', pnl: -24.34 }),
      createMockTrade({ entryId: 'W817670447989380', pnl: -44.0 }),
      createMockTrade({ entryId: 'W817670447942815', pnl: -47.26 }),
      createMockTrade({ entryId: 'W555751920417166', pnl: 58.74 }),
      createMockTrade({ entryId: 'W6441026807866066', pnl: -41.92 }),
      createMockTrade({ entryId: 'W6441026807863474', pnl: -8.35 }),
    ]

    const grouped = groupTradesByExecution(trades)
    expect(grouped.length).toBe(14)

    const rawTotal = Math.round(trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0) * 100) / 100
    const groupedTotal = Math.round(grouped.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0) * 100) / 100
    expect(rawTotal).toBe(76.99)
    expect(groupedTotal).toBe(76.99)

    const groupedOutcomeCounts = grouped.reduce(
      (acc, trade) => {
        const outcome = classifyOutcome(Number(trade.pnl || 0), 10)
        if (outcome === 'win') acc.win += 1
        else if (outcome === 'loss') acc.loss += 1
        else acc.breakeven += 1
        return acc
      },
      { win: 0, loss: 0, breakeven: 0 }
    )

    expect(groupedOutcomeCounts).toEqual({
      win: 4,
      loss: 9,
      breakeven: 1,
    })

    const partialGroup = grouped.find(trade => trade.entryId === 'W8176704479552664')
    expect(partialGroup?.partialTrades.length).toBe(4)
    expect(Math.round(Number(partialGroup?.pnl || 0) * 100) / 100).toBe(159.69)
  })
})

describe('Financial calculations - performance score metrics', () => {
  it('calculates the inputs for the JJI performance score', () => {
    const trades = [
      { pnl: 200, commission: 0, entryDate: '2024-01-01T10:00:00Z' },
      { pnl: 300, commission: 0, entryDate: '2024-01-02T10:00:00Z' },
      { pnl: -100, commission: 0, entryDate: '2024-01-03T10:00:00Z' },
      { pnl: -50, commission: 0, entryDate: '2024-01-04T10:00:00Z' },
      { pnl: 10, commission: 0, entryDate: '2024-01-05T10:00:00Z' },
      { pnl: 10, commission: 0, entryDate: '2024-01-06T10:00:00Z' },
      { pnl: 10, commission: 0, entryDate: '2024-01-07T10:00:00Z' },
      { pnl: -10, commission: 0, entryDate: '2024-01-08T10:00:00Z' },
      { pnl: -10, commission: 0, entryDate: '2024-01-09T10:00:00Z' },
      { pnl: -10, commission: 0, entryDate: '2024-01-10T10:00:00Z' },
    ]

    const metrics = calculateMetricsFromTrades(trades)
    
    expect(metrics).not.toBeNull()
    expect(metrics?.profitFactor).toBeCloseTo(3.33, 2)
    expect(metrics?.tradeWinPercentage).toBe(50) // 2 wins, 2 losses
  })

  it('should return null for empty trades array', () => {
    const metrics = calculateMetricsFromTrades([])
    expect(metrics).toBeNull()
  })
})

describe('Financial Calculations - Edge Cases', () => {
  it('should handle empty trades array', () => {
    const stats = calculateStatistics([], [])
    expect(stats.totalPnL).toBe(0)
    expect(stats.winRate).toBe(0)
    expect(stats.profitFactor).toBe(0)
    expect(stats.nbWin).toBe(0)
    expect(stats.nbLoss).toBe(0)
  })

  it('should handle trades with zero P&L', () => {
    const trades = [
      createMockTrade({ pnl: 0, commission: 0 }),
      createMockTrade({ pnl: 0, commission: 0 }),
    ]

    const stats = calculateStatistics(trades, [])
    expect(stats.totalPnL).toBe(0)
    expect(stats.winRate).toBe(0) // No tradable trades
    expect(stats.profitFactor).toBe(0)
  })

  it('should handle very large numbers', () => {
    const trades = [
      createMockTrade({ pnl: 1000000, commission: 0 }),
      createMockTrade({ pnl: -500000, commission: 0 }),
    ]

    const stats = calculateStatistics(trades, [])
    expect(stats.totalPnL).toBe(500000)
    expect(stats.profitFactor).toBe(2)
  })

  it('should handle very small decimal numbers', () => {
    const trades = [
      createMockTrade({ pnl: 0.01, commission: 0 }),
      createMockTrade({ pnl: -0.005, commission: 0 }),
    ]

    const stats = calculateStatistics(trades, [])
    expect(stats.totalPnL).toBeCloseTo(0.005, 3)
  })
})

describe('Financial Calculations - Decimal Precision', () => {
  it('should preserve decimal precision in P&L calculations', () => {
    const trades = [
      createMockTrade({ pnl: 123.456, commission: 0 }),
      createMockTrade({ pnl: -45.678, commission: 0 }),
    ]

    const stats = calculateStatistics(trades, [])
    expect(stats.totalPnL).toBeCloseTo(77.778, 3)
  })

  it('should preserve pnl precision regardless of commission field', () => {
    const trades = [
      createMockTrade({ pnl: 100.50, commission: 2.25 }),
      createMockTrade({ pnl: -50.75, commission: 1.50 }),
    ]

    const stats = calculateStatistics(trades, [])
    expect(stats.totalPnL).toBeCloseTo(49.75, 2)
  })
})
