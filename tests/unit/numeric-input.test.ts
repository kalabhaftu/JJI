import { describe, expect, it } from 'vitest'

import { parseNumericInput } from '@/lib/form-fields'

describe('parseNumericInput(raw, options)', () => {
  it('returns a number for formatted currency text', () => {
    expect(parseNumericInput('$1,234.50')).toBe(1234.5)
    expect(parseNumericInput('  $ 5,000 ')).toBe(5000)
    expect(parseNumericInput('-12.5%')).toBe(-12.5)
  })

  it('returns undefined while the value is empty or incomplete', () => {
    expect(parseNumericInput('')).toBeUndefined()
    expect(parseNumericInput('   ')).toBeUndefined()
    expect(parseNumericInput('-')).toBeUndefined()
    expect(parseNumericInput('1.2.3')).toBeUndefined()
    expect(parseNumericInput('abc')).toBeUndefined()
  })

  it('returns null for an empty value when allowEmpty is set', () => {
    expect(parseNumericInput('', { allowEmpty: true })).toBeNull()
    expect(parseNumericInput('   ', { allowEmpty: true })).toBeNull()
  })

  it('keeps invalid partial values as undefined even with allowEmpty', () => {
    expect(parseNumericInput('1.2.3', { allowEmpty: true })).toBeUndefined()
    expect(parseNumericInput('abc', { allowEmpty: true })).toBeUndefined()
  })

  it('rounds to the requested number of decimals', () => {
    expect(parseNumericInput('123.456', { decimals: 2 })).toBe(123.46)
    expect(parseNumericInput('100', { decimals: 2 })).toBe(100)
    expect(parseNumericInput('2.005', { decimals: 2 })).toBe(2.01)
  })

  it('does not round by default', () => {
    expect(parseNumericInput('123.456')).toBe(123.456)
  })
})