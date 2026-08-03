import { describe, expect, it, vi } from 'vitest'

import { focusFirstInvalidField, parseNumericInput } from '@/lib/form-fields'

describe('parseNumericInput', () => {
  it('parses formatted numeric text without turning incomplete input into zero', () => {
    expect(parseNumericInput(' $1,234.50 ')).toBe(1234.5)
    expect(parseNumericInput('-2.5%')).toBe(-2.5)
    expect(parseNumericInput('')).toBeUndefined()
    expect(parseNumericInput('-')).toBeUndefined()
    expect(parseNumericInput('1.2.3')).toBeUndefined()
  })
})

describe('focusFirstInvalidField', () => {
  it('focuses the first invalid control in DOM order', () => {
    document.body.innerHTML = `
      <form>
        <input name="second" aria-invalid="true" />
        <input name="first" aria-invalid="true" />
      </form>
    `
    const first = document.querySelector('[name="second"]') as HTMLInputElement
    const focus = vi.spyOn(first, 'focus')
    const scrollIntoView = vi.spyOn(first, 'scrollIntoView')

    expect(focusFirstInvalidField(document.querySelector('form')!)).toBe(first)
    expect(focus).toHaveBeenCalledOnce()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })
})
