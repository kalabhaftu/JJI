import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ControlledSelect,
  CurrencyField,
  DateTimeTimezoneField,
  PercentageField,
  SymbolCombobox,
  TagMultiSelect,
} from '@/components/ui/domain-fields'
import { FormErrorSummary } from '@/components/ui/form-error-summary'

const roots: Array<ReturnType<typeof createRoot>> = []

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = TestResizeObserver

afterEach(async () => {
  await act(async () => roots.splice(0).forEach((root) => root.unmount()))
  document.body.innerHTML = ''
})

function render(element: React.ReactElement) {
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  roots.push(root)
  return act(async () => root.render(element))
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

describe('domain field primitives', () => {
  it('keeps select value controlled and emits the selected value', async () => {
    const onChange = vi.fn()
    await render(
      <ControlledSelect
        aria-label="Direction"
        value="long"
        onValueChange={onChange}
        options={[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }]}
      />
    )
    const trigger = document.querySelector('[aria-label="Direction"]') as HTMLButtonElement
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await act(async () => trigger.click())
    await act(async () => (document.querySelector('[role="option"][data-value="short"]') as HTMLElement).click())
    expect(onChange).toHaveBeenCalledWith('short')
  })

  it('normalizes currency and percentage input while preserving accessible labels', async () => {
    const currencyChange = vi.fn()
    const percentageChange = vi.fn()
    await render(
      <>
        <CurrencyField aria-label="Entry price" value={12.5} onValueChange={currencyChange} />
        <PercentageField aria-label="Risk percentage" value={1.25} onValueChange={percentageChange} />
      </>
    )
    const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[]
    expect(inputs[0]).toHaveAttribute('inputmode', 'decimal')
    await act(async () => {
      setInputValue(inputs[0], '$1,250.00')
      setInputValue(inputs[1], '2.5%')
    })
    expect(currencyChange).toHaveBeenCalledWith(1250)
    expect(percentageChange).toHaveBeenCalledWith(2.5)
  })

  it('exposes timezone as a separate controlled select from the local date-time', async () => {
    await render(
      <DateTimeTimezoneField
        dateTime="2026-08-04T12:30"
        timezone="America/New_York"
        onDateTimeChange={vi.fn()}
        onTimezoneChange={vi.fn()}
        timezones={[{ value: 'America/New_York', label: 'Eastern Time' }]}
      />
    )
    expect(document.querySelector('input[type="datetime-local"]')).toHaveValue('2026-08-04T12:30')
    expect(document.querySelector('[aria-label="Timezone"]')).toBeTruthy()
  })

  it('provides searchable symbol and tag multi-select controls', async () => {
    const symbolChange = vi.fn()
    const tagsChange = vi.fn()
    await render(
      <>
        <SymbolCombobox aria-label="Symbol" value="ES" onValueChange={symbolChange} options={[{ value: 'ES', label: 'ES' }, { value: 'NQ', label: 'NQ' }]} />
        <TagMultiSelect aria-label="Tags" value={['breakout']} onValueChange={tagsChange} options={[{ value: 'breakout', label: 'Breakout' }, { value: 'reversal', label: 'Reversal' }]} />
      </>
    )
    expect(document.querySelector('[aria-label="Symbol"]')).toBeTruthy()
    expect(document.querySelector('[aria-label="Tags"]')).toHaveAttribute('role', 'group')
    expect(document.querySelector('[aria-label="Tags"]')).not.toHaveAttribute('aria-multiselectable')
  })

  it('summarizes errors in an assertive live region with linked fields', async () => {
    await render(<FormErrorSummary errors={{ symbol: 'Symbol is required', amount: 'Amount is invalid' }} />)
    const summary = document.querySelector('[role="alert"]')!
    expect(summary).toHaveTextContent('2 errors')
    expect(summary).toHaveTextContent('Symbol is required')
    expect(summary.querySelector('a[href="#symbol"]')).toBeTruthy()
  })
})
