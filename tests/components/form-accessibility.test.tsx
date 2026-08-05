import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ControlledSelect,
  CurrencyField,
  DateTimeTimezoneField,
  EditableTableField,
  FormErrorSummary,
  PercentageField,
  SymbolCombobox,
  TagMultiSelect,
} from '@/components/ui/domain-fields'
import { focusFirstInvalidField } from '@/lib/form-fields'

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

async function render(element: React.ReactElement) {
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  roots.push(root)
  await act(async () => root.render(element))
}

describe('form-level accessibility contracts', () => {
  it('links the error summary to invalid fields and focuses the first one on click', async () => {
    const onChange = vi.fn()
    await render(
      <form id="trade-form">
        <CurrencyField id="entry-price" aria-label="Entry price" value={12.5} aria-invalid="true" onValueChange={onChange} />
        <FormErrorSummary errors={{ 'entry-price': 'Entry price is required' }} />
      </form>
    )
    const anchor = document.querySelector<HTMLAnchorElement>('a[href="#entry-price"]')!
    expect(anchor).toBeTruthy()
    const field = document.querySelector('input') as HTMLInputElement
    expect(document.getElementById(anchor.getAttribute('href')!.slice(1))).toBe(field)
    const focus = vi.spyOn(field, 'focus')
    const scrollIntoView = vi.spyOn(field, 'scrollIntoView')
    anchor.addEventListener('click', (event) => {
      event.preventDefault()
      focusFirstInvalidField(document.querySelector('form')!)
    })
    await act(async () => anchor.click())
    expect(focus).toHaveBeenCalledOnce()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })

  it('announces errors in an assertive live region', async () => {
    await render(<FormErrorSummary errors={{ symbol: 'Symbol is required' }} />)
    const summary = document.querySelector('[role="alert"]')!
    expect(summary).toHaveAttribute('role', 'alert')
    expect(summary).toHaveAttribute('aria-live', 'assertive')
  })

  it('gives every domain field an accessible name without a visible label', async () => {
    await render(
      <>
        <CurrencyField aria-label="Entry price" value={12.5} onValueChange={vi.fn()} />
        <PercentageField aria-label="Risk percentage" value={1.25} onValueChange={vi.fn()} />
        <ControlledSelect
          aria-label="Direction"
          value="long"
          onValueChange={vi.fn()}
          options={[{ value: 'long', label: 'Long' }]}
        />
        <SymbolCombobox aria-label="Symbol" onValueChange={vi.fn()} options={[{ value: 'ES', label: 'ES' }]} />
        <TagMultiSelect
          aria-label="Tags"
          value={[]}
          onValueChange={vi.fn()}
          options={[{ value: 'breakout', label: 'Breakout' }]}
        />
        <DateTimeTimezoneField
          dateTime="2026-08-04T12:30"
          timezone="America/New_York"
          onDateTimeChange={vi.fn()}
          onTimezoneChange={vi.fn()}
          timezones={[{ value: 'America/New_York', label: 'Eastern Time' }]}
        />
        <EditableTableField aria-label="Size" value="ABC" onValueChange={vi.fn()} />
      </>
    )
    expect(document.querySelector('input[aria-label="Entry price"]')).toHaveAccessibleName('Entry price')
    expect(document.querySelector('input[aria-label="Risk percentage"]')).toHaveAccessibleName('Risk percentage')
    expect(document.querySelector('[aria-label="Direction"]')).toHaveAccessibleName('Direction')
    expect(document.querySelector('[aria-label="Symbol"]')).toHaveAccessibleName('Symbol')
    expect(document.querySelector('[aria-label="Tags"]')).toHaveAccessibleName('Tags')
    expect(document.querySelector('input[aria-label="Date and time"]')).toHaveAccessibleName('Date and time')
    expect(document.querySelector('input[aria-label="Size"]')).toHaveAccessibleName('Size')
  })
})
