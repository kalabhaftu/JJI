import { describe, expect, it } from 'vitest'

import { formatFinancialValue } from '@/lib/formatting/financial-value'

describe('formatFinancialValue', () => {
  it('returns Unavailable for null, undefined, and non-finite values', () => {
    expect(formatFinancialValue(null, { kind: 'currency' })).toBe('Unavailable')
    expect(formatFinancialValue(undefined, { kind: 'pnl' })).toBe('Unavailable')
    expect(formatFinancialValue(Number.NaN, { kind: 'points' })).toBe('Unavailable')
    expect(formatFinancialValue(Number.POSITIVE_INFINITY, { kind: 'currency' })).toBe('Unavailable')
  })

  it('formats currency kinds with two fraction digits and the locale currency', () => {
    for (const kind of ['currency', 'pnl', 'fees', 'commission', 'drawdown'] as const) {
      expect(formatFinancialValue(1234.5, { kind })).toBe('$1,234.50')
    }
    expect(formatFinancialValue(1234.5, { kind: 'pnl', currency: 'EUR', locale: 'de-DE' })).toBe('1.234,50\u00a0€')
  })

  it('prepends an explicit plus sign only when requested for positive values', () => {
    expect(formatFinancialValue(12.5, { kind: 'pnl', explicitSign: true })).toBe('+$12.50')
    expect(formatFinancialValue(-12.5, { kind: 'pnl', explicitSign: true })).toBe('-$12.50')
    expect(formatFinancialValue(12.5, { kind: 'pnl' })).toBe('$12.50')
  })

  it('formats percentages with a percent suffix and two fraction digits', () => {
    expect(formatFinancialValue(2.5, { kind: 'percentage' })).toBe('2.5%')
    expect(formatFinancialValue(-1.5, { kind: 'percentage', explicitSign: true })).toBe('-1.5%')
    expect(formatFinancialValue(0.12345, { kind: 'percentage' })).toBe('0.12%')
  })

  it('formats risk-reward with a :1 suffix', () => {
    expect(formatFinancialValue(3.5, { kind: 'risk-reward' })).toBe('3.5:1')
    expect(formatFinancialValue(3.5, { kind: 'risk-reward', explicitSign: true })).toBe('+3.5:1')
  })

  it('formats points and ticks with default unit labels', () => {
    expect(formatFinancialValue(25, { kind: 'points' })).toBe('25 pts')
    expect(formatFinancialValue(25, { kind: 'ticks' })).toBe('25 ticks')
    expect(formatFinancialValue(25, { kind: 'quantity' })).toBe('25')
  })

  it('appends a custom unit when provided and keeps four fraction digits for raw kinds', () => {
    expect(formatFinancialValue(1.5, { kind: 'points', unit: 'ES' })).toBe('1.5 ES')
    expect(formatFinancialValue(0.123456, { kind: 'quantity' })).toBe('0.1235')
  })

  it('honors the locale for number grouping', () => {
    expect(formatFinancialValue(1234567.5, { kind: 'pnl' })).toBe('$1,234,567.50')
    expect(formatFinancialValue(1234567.5, { kind: 'pnl', locale: 'de-DE' })).toBe('1.234.567,50\u00a0$')
  })
})
