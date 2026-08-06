import { describe, it, expect } from 'vitest'
import { computeDashboardAggregates } from '@/lib/statistics/report-statistics'
import { resolveDashboardDataQuality } from '@/lib/dashboard/aggregates-quality'

function createTrade(overrides: Record<string, unknown> = {}) {
  const uniqueId = Math.random().toString(36).substring(7)
  return {
    id: `agg-test-${uniqueId}`,
    entryId: `entry-${uniqueId}`,
    entryDate: '2024-01-01T10:00:00Z',
    pnl: 100,
    commission: 0,
    accountId: null,
    accountNumber: 'TEST123',
    phaseAccountId: null,
    ...overrides,
  }
}

describe('computeDashboardAggregates', () => {
  it('keeps win rate identity with the existing win rate semantics', () => {
    const trades = [
      createTrade({ pnl: 100 }),
      createTrade({ pnl: 200 }),
      createTrade({ pnl: -100 }),
      createTrade({ pnl: 50 }),
    ]
    const metrics = computeDashboardAggregates(trades, { includeFees: false })

    expect(metrics.winRate.value).toBe(75)
    expect(metrics.winRate.formatted).toBe('75.0%')
  })

  it('excludes break-even trades from win rate', () => {
    const trades = [
      createTrade({ pnl: 100 }),
      createTrade({ pnl: 0 }),
      createTrade({ pnl: -100 }),
    ]
    const metrics = computeDashboardAggregates(trades, { includeFees: false })

    expect(metrics.winRate.value).toBe(50)
  })

  it('sums canonical trade.pnl into the aggregate pnl', () => {
    const trades = [
      createTrade({ pnl: 200 }),
      createTrade({ pnl: -100 }),
      createTrade({ pnl: 300 }),
    ]
    const metrics = computeDashboardAggregates(trades, { includeFees: false })

    expect(metrics.pnl.value).toBe(400)
    expect(metrics.pnl.formatted).toBe('$400.00')
    expect(metrics.tradeCount).toBe(3)
  })

  it('computes gross pnl when fees are excluded and net pnl when included', () => {
    const trades = [
      createTrade({ pnl: 100, commission: -10 }),
      createTrade({ pnl: 50, commission: -25 }),
    ]
    const gross = computeDashboardAggregates(trades, { includeFees: false })
    const net = computeDashboardAggregates(trades, { includeFees: true })

    expect(gross.pnl.value).toBe(150)
    expect(net.pnl.value).toBe(115)
  })

  it('computes peak-to-trough drawdown from cumulative pnl', () => {
    const trades = [
      createTrade({ pnl: 100, entryDate: '2024-01-01T10:00:00Z' }),
      createTrade({ pnl: -50, entryDate: '2024-01-02T10:00:00Z' }),
      createTrade({ pnl: 60, entryDate: '2024-01-03T10:00:00Z' }),
    ]
    const metrics = computeDashboardAggregates(trades, { includeFees: false })

    expect(metrics.drawdown.value).toBe(50)
  })

  it('counts grouped executions, preserving partial-close totals', () => {
    const trades = [
      createTrade({ entryId: 'E1', pnl: 50 }),
      createTrade({ entryId: 'E1', pnl: 100 }),
      createTrade({ entryId: 'E2', pnl: 200 }),
    ]
    const metrics = computeDashboardAggregates(trades, { includeFees: false })

    expect(metrics.tradeCount).toBe(2)
    expect(metrics.pnl.value).toBe(350)
  })

  it('uses the break-even threshold for win classification', () => {
    const trades = [
      createTrade({ pnl: 20 }),
      createTrade({ pnl: -20 }),
    ]
    const tight = computeDashboardAggregates(trades, { includeFees: false, breakEvenThreshold: 10 })
    const wide = computeDashboardAggregates(trades, { includeFees: false, breakEvenThreshold: 50 })

    expect(tight.winRate.value).toBe(50)
    expect(wide.winRate.value).toBe(0)
  })

  it('formats money in the requested currency when provided', () => {
    const trades = [createTrade({ pnl: 250 })]
    const metrics = computeDashboardAggregates(trades, { includeFees: false, currency: 'EUR' })

    expect(metrics.pnl.formatted).toContain('€')
    expect(metrics.pnl.value).toBe(250)
  })

  it('returns zeroed aggregates for empty input', () => {
    const metrics = computeDashboardAggregates([], { includeFees: false })

    expect(metrics.pnl.value).toBe(0)
    expect(metrics.winRate.value).toBe(0)
    expect(metrics.winRate.formatted).toBe('0.0%')
    expect(metrics.drawdown.value).toBe(0)
    expect(metrics.tradeCount).toBe(0)
  })
})

describe('resolveDashboardDataQuality', () => {
  it('passes the server quality through when fresh data is present', () => {
    expect(resolveDashboardDataQuality({ serverQuality: 'current', hasData: true, isRefetching: false, refetchFailed: false })).toBe('current')
    expect(resolveDashboardDataQuality({ serverQuality: 'partial', hasData: true, isRefetching: false, refetchFailed: false })).toBe('partial')
  })

  it('marks data stale when the refresh failed but cached data exists', () => {
    const quality = resolveDashboardDataQuality({ serverQuality: 'current', hasData: true, isRefetching: false, refetchFailed: true })
    expect(quality).toBe('stale')
  })

  it('does not mark stale while a retry is in flight', () => {
    const quality = resolveDashboardDataQuality({ serverQuality: undefined, hasData: true, isRefetching: true, refetchFailed: true })
    expect(quality).not.toBe('stale')
  })

  it('falls back to unavailable when there is no data and no server quality', () => {
    const quality = resolveDashboardDataQuality({ serverQuality: undefined, hasData: false, isRefetching: false, refetchFailed: true })
    expect(quality).toBe('unavailable')
  })
})
