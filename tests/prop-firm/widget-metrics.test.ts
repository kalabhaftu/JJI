import { describe, expect, it } from 'vitest'
import {
  buildPropFirmAccountExtremes,
  buildPropFirmDailyDrawdown,
  buildPropFirmGrowth,
  buildPropFirmTodayStats,
  formatPropFirmAxisMoney,
  getPropFirmDateKey,
} from '@/lib/prop-firm/widget-metrics'

const account = {
  accountSize: 5000,
  currentPhase: {
    dailyDrawdownPercent: 5,
    maxDrawdownPercent: 12,
  },
}

describe('prop firm widget metrics', () => {
  it('uses the selected reset timezone for today stats', () => {
    const trades = [
      { id: '1', netPnL: 100, exitTime: '2026-05-22T00:30:00.000Z' },
      { id: '2', netPnL: -50, exitTime: '2026-05-21T22:30:00.000Z' },
    ]

    expect(getPropFirmDateKey(new Date('2026-05-22T00:30:00.000Z'), 'UTC')).toBe('2026-05-22')
    expect(getPropFirmDateKey(new Date('2026-05-22T00:30:00.000Z'), 'America/New_York')).toBe('2026-05-21')
    expect(buildPropFirmTodayStats(trades, 'UTC', new Date('2026-05-22T08:00:00.000Z')).trades).toBe(1)
    expect(buildPropFirmTodayStats(trades, 'America/New_York', new Date('2026-05-22T08:00:00.000Z')).trades).toBe(0)
  })

  it('builds account-wide extremes instead of today-only extremes', () => {
    const extremes = buildPropFirmAccountExtremes([
      { id: '1', netPnL: 120, exitTime: '2026-05-20T10:00:00.000Z' },
      { id: '2', netPnL: -80, exitTime: '2026-05-22T10:00:00.000Z' },
    ])

    expect(extremes.bestTrade).toBe(120)
    expect(extremes.worstTrade).toBe(-80)
  })

  it('calculates daily drawdown from the UTC reset boundary', () => {
    const daily = buildPropFirmDailyDrawdown(
      account,
      [
        { id: '1', netPnL: 100, exitTime: '2026-05-21T12:00:00.000Z' },
        { id: '2', netPnL: -60, exitTime: '2026-05-22T12:00:00.000Z' },
      ],
      'UTC',
      new Date('2026-05-22T18:00:00.000Z')
    )

    expect(daily.dailyStartBalance).toBe(5100)
    expect(daily.dailyDrawdownUsed).toBe(60)
    expect(daily.dailyDrawdownRemaining).toBe(190)
    expect(daily.dailyLossFloor).toBe(4850)
  })

  it('builds growth points from grouped trades and preserves starting balance externally', () => {
    const growth = buildPropFirmGrowth(account, [
      { id: 'group-1', netPnL: 75, exitTime: '2026-05-22T12:00:00.000Z' },
      { id: 'group-2', netPnL: -25, exitTime: '2026-05-22T13:00:00.000Z' },
    ])

    expect(growth.points).toHaveLength(2)
    expect(growth.points[0].balance).toBe(5075)
    expect(growth.points[1].balance).toBe(5050)
    expect(growth.tradingDays).toBe(1)
  })

  it('formats prop firm axis money without compacting drawdown levels', () => {
    expect(formatPropFirmAxisMoney(4400)).toBe('$4,400')
    expect(formatPropFirmAxisMoney(50000)).toBe('$50,000')
  })

  it('freezes daily drawdown start balance and loss floor when account breaches', () => {
    const failedAccount = {
      accountSize: 50000,
      currentPhase: {
        dailyDrawdownPercent: 5,
        maxDrawdownPercent: 10,
        maxDrawdownType: 'static',
      },
    }


    const trades = [
      { id: '1', netPnL: -1000, exitTime: '2026-06-21T12:00:00.000Z' },
      { id: '2', netPnL: -4000, exitTime: '2026-06-22T12:00:00.000Z' },
      { id: '3', netPnL: -1000, exitTime: '2026-06-23T12:00:00.000Z' },
    ]

    const daily = buildPropFirmDailyDrawdown(
      failedAccount,
      trades,
      'UTC',
      new Date('2026-06-23T18:00:00.000Z')
    )

    expect(daily.isBreached).toBe(true)
    expect(daily.breachType).toBe('daily_drawdown')
    expect(daily.dailyStartBalance).toBe(49000)
    expect(daily.dailyLossFloor).toBe(46500)
  })
})
