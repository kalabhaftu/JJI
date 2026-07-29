import { describe, expect, it } from 'vitest'

import {
  checkHistoricalDailyDrawdowns,
  checkHistoricalMaxDrawdown,
  getNetPnl,
} from '@/lib/prop-firm/phase-evaluation/breach'
import { calculateDrawdown } from '@/lib/prop-firm/phase-evaluation/drawdown'
import { calculatePhaseProgress } from '@/lib/prop-firm/phase-evaluation/progress'
import {
  buildPhaseEvaluationMetrics,
  evaluateCurrentPhase,
  evaluateHistoricalBreaches,
} from '@/lib/prop-firm/phase-evaluation/evaluate'
import {
  calculateDailyAnchorEquity,
  getDailyAnchorDate,
  resolveDailyAnchorValue,
} from '@/lib/prop-firm/phase-evaluation/anchor'

const evaluatedAt = new Date('2026-07-29T12:00:00.000Z')
const baseRules = {
  dailyDrawdownPercent: 5,
  maxDrawdownPercent: 10,
  maxDrawdownType: 'static',
  profitTargetPercent: 8,
  minTradingDays: 2,
  startDate: '2026-07-20T00:00:00.000Z',
  MasterAccount: { accountSize: 50_000 },
}

describe('phase evaluation calculations', () => {
  it('uses commission-adjusted net P/L', () => {
    expect(getNetPnl({ pnl: 100, commission: -8 })).toBe(92)
    expect(getNetPnl({ pnl: null, commission: -4 })).toBe(-4)
  })

  it('returns a stable no-trade daily state', () => {
    expect(checkHistoricalDailyDrawdowns(
      baseRules,
      [],
      50_000,
      'UTC',
    )).toEqual({
      isBreached: false,
      dayStartBalance: 50_000,
      dayEndBalance: 50_000,
      dayLoss: 0,
      dailyLimit: 2_500,
    })
  })

  it('uses UTC day boundaries for historical daily breaches', () => {
    const result = checkHistoricalDailyDrawdowns(
      baseRules,
      [
        {
          pnl: 500,
          exitTime: '2026-07-20T23:59:00.000Z',
        },
        {
          pnl: -2_600,
          commission: -10,
          exitTime: '2026-07-21T00:01:00.000Z',
        },
      ],
      50_000,
      'UTC',
    )

    expect(result.isBreached).toBe(true)
    expect(result.breachDate).toBe('2026-07-21')
    expect(result.dayStartBalance).toBe(50_500)
    expect(result.dayLoss).toBe(2_610)
    expect(result.breachAmount).toBe(110)
  })

  it('does not breach at the exact daily boundary', () => {
    const result = checkHistoricalDailyDrawdowns(
      baseRules,
      [{ pnl: -2_500, exitTime: '2026-07-21T10:00:00.000Z' }],
      50_000,
      'UTC',
    )

    expect(result.isBreached).toBe(false)
  })

  it('does not breach at the exact static maximum boundary', () => {
    const result = checkHistoricalMaxDrawdown(
      [{ pnl: -5_000, exitTime: '2026-07-21T10:00:00.000Z' }],
      50_000,
      10,
      'static',
    )

    expect(result.isBreached).toBe(false)
    expect(result.lowestBalance).toBe(45_000)
  })

  it('detects a recovered historical static max-drawdown breach', () => {
    const result = checkHistoricalMaxDrawdown(
      [
        { pnl: -5_100, exitTime: '2026-07-20T10:00:00.000Z' },
        { pnl: 6_000, exitTime: '2026-07-21T10:00:00.000Z' },
      ],
      50_000,
      10,
      'static',
    )

    expect(result.isBreached).toBe(true)
    expect(result.lowestBalance).toBe(44_900)
    expect(result.breachAmount).toBe(100)
  })

  it('uses the high-water mark for trailing max drawdown', () => {
    const result = checkHistoricalMaxDrawdown(
      [
        { pnl: 5_000, exitTime: '2026-07-20T10:00:00.000Z' },
        { pnl: -6_000, exitTime: '2026-07-21T10:00:00.000Z' },
      ],
      50_000,
      10,
      'trailing',
    )

    expect(result.maxDrawdownLimit).toBe(5_500)
    expect(result.minAllowedBalance).toBe(49_500)
    expect(result.isBreached).toBe(true)
  })

  it('prioritizes a daily breach over max drawdown', () => {
    const result = calculateDrawdown(
      baseRules,
      44_000,
      50_000,
      50_000,
      50_000,
      evaluatedAt,
    )

    expect(result.isBreached).toBe(true)
    expect(result.breachType).toBe('daily_drawdown')
    expect(result.breachTime).toEqual(evaluatedAt)
  })

  it('allows recovery without reporting used drawdown below zero', () => {
    const result = calculateDrawdown(
      baseRules,
      51_000,
      50_000,
      51_000,
      50_000,
      evaluatedAt,
    )

    expect(result.isBreached).toBe(false)
    expect(result.dailyDrawdownUsed).toBe(0)
    expect(result.maxDrawdownUsed).toBe(0)
  })

  it('requires both target and minimum UTC trading days', () => {
    const oneDay = calculatePhaseProgress(
      baseRules,
      4_000,
      [
        { pnl: 2_000, exitTime: '2026-07-20T01:00:00.000Z' },
        { pnl: 2_000, exitTime: '2026-07-20T22:00:00.000Z' },
      ],
      evaluatedAt,
    )
    const twoDays = calculatePhaseProgress(
      baseRules,
      4_000,
      [
        { pnl: 2_000, exitTime: '2026-07-20T23:59:00.000Z' },
        { pnl: 2_000, exitTime: '2026-07-21T00:01:00.000Z' },
      ],
      evaluatedAt,
    )

    expect(oneDay.canPassPhase).toBe(false)
    expect(twoDays.canPassPhase).toBe(true)
    expect(twoDays.profitTargetPercent).toBe(100)
  })

  it('uses an injected clock for time limits', () => {
    const progress = calculatePhaseProgress(
      { ...baseRules, profitTargetPercent: 0, timeLimitDays: 5 },
      0,
      [
        { pnl: 0, exitTime: '2026-07-20T10:00:00.000Z' },
        { pnl: 0, exitTime: '2026-07-21T10:00:00.000Z' },
      ],
      evaluatedAt,
    )

    expect(progress.daysRemaining).toBe(-4)
    expect(progress.canPassPhase).toBe(false)
  })

  it('keeps failure-first semantics when target and breach happen together', () => {
    const rules = {
      ...baseRules,
      minTradingDays: 1,
      profitTargetPercent: 1,
    }
    const trades = [
      { pnl: 5_000, exitTime: '2026-07-20T10:00:00.000Z' },
      { pnl: -4_000, exitTime: '2026-07-20T11:00:00.000Z' },
    ]
    const master = {
      accountSize: 50_000,
      userId: 'user-1',
      accountName: 'Challenge',
    }
    const metrics = buildPhaseEvaluationMetrics(
      rules,
      trades,
      master,
      evaluatedAt,
    )
    expect(metrics.progress.canPassPhase).toBe(true)

    const result = evaluateCurrentPhase(
      'phase-1',
      rules,
      master,
      metrics,
      55_000,
      evaluatedAt,
    )
    expect(result.isFailed).toBe(true)
    expect(result.isPassed).toBe(false)
    expect(result.canAdvance).toBe(false)
    expect(result.nextAction).toBe('fail')
  })

  it('returns the same historical decision when evaluation repeats', () => {
    const trades = [
      { pnl: -2_600, exitTime: '2026-07-20T10:00:00.000Z' },
      { pnl: 4_000, exitTime: '2026-07-21T10:00:00.000Z' },
    ]
    const master = {
      accountSize: 50_000,
      userId: 'user-1',
      accountName: 'Challenge',
    }
    const metrics = buildPhaseEvaluationMetrics(
      baseRules,
      trades,
      master,
      evaluatedAt,
    )
    const evaluate = () => evaluateHistoricalBreaches(
      'phase-1',
      baseRules,
      trades,
      master,
      metrics,
    )

    expect(evaluate()).toEqual(evaluate())
    expect(evaluate()?.nextAction).toBe('fail')
  })

  it('creates a stable UTC anchor from commission-adjusted prior trades', () => {
    expect(getDailyAnchorDate(
      new Date('2026-07-29T23:59:59.000Z'),
      'UTC',
    )).toEqual(new Date('2026-07-29T00:00:00.000Z'))
    expect(calculateDailyAnchorEquity(50_000, [
      { pnl: 500, commission: -15 },
      { pnl: -100, commission: -5 },
    ])).toBe(50_380)
  })

  it('prefers a durable anchor and safely falls back when creation fails', () => {
    expect(resolveDailyAnchorValue(50_250, 50_100, 50_000)).toBe(50_250)
    expect(resolveDailyAnchorValue(undefined, 50_100, 50_000)).toBe(50_100)
    expect(resolveDailyAnchorValue(undefined, undefined, 50_000)).toBe(50_000)
  })
})
