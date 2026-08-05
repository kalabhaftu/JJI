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
  return root
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

describe('numeric field contracts', () => {
  it('renders decimal text inputs that emit parsed values and clear as undefined', async () => {
    const currencyChange = vi.fn()
    const percentageChange = vi.fn()
    await render(
      <>
        <CurrencyField aria-label="Entry price" value={12.5} onValueChange={currencyChange} />
        <PercentageField aria-label="Risk percentage" value={1.25} onValueChange={percentageChange} />
      </>
    )
    const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[]
    expect(inputs[0]).toHaveAttribute('type', 'text')
    expect(inputs[0]).toHaveAttribute('inputmode', 'decimal')
    expect(inputs[1]).toHaveAttribute('inputmode', 'decimal')

    await act(async () => {
      setInputValue(inputs[0], '123.50')
      setInputValue(inputs[1], '2.5%')
    })
    expect(currencyChange).toHaveBeenCalledWith(123.5)
    expect(percentageChange).toHaveBeenCalledWith(2.5)

    await act(async () => setInputValue(inputs[0], '1.2.3'))
    expect(currencyChange).toHaveBeenLastCalledWith(undefined)

    await act(async () => setInputValue(inputs[0], ''))
    expect(currencyChange).toHaveBeenLastCalledWith(undefined)
  })

  it('re-syncs the draft when the external value prop changes', async () => {
    const onChange = vi.fn()
    const root = await render(<CurrencyField aria-label="Entry price" value={5} onValueChange={onChange} />)
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('5')
    await act(async () => root.render(<CurrencyField aria-label="Entry price" value={7.5} onValueChange={onChange} />))
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('7.5')
  })
})

describe('ControlledSelect', () => {
  it('passes trigger semantics through and emits the selected option value', async () => {
    const onChange = vi.fn()
    await render(
      <ControlledSelect
        aria-label="Direction"
        aria-invalid
        value="long"
        onValueChange={onChange}
        options={[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }]}
      />
    )
    const trigger = document.querySelector('[role="combobox"]') as HTMLButtonElement
    expect(trigger).toHaveAccessibleName('Direction')
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(document.querySelector('[role="option"]')).toBeNull()
    await act(async () => trigger.click())
    expect(Array.from(document.querySelectorAll('[role="option"]'))).toHaveLength(2)
    await act(async () => (document.querySelector('[role="option"][data-value="short"]') as HTMLElement).click())
    expect(onChange).toHaveBeenCalledWith('short')
  })
})

describe('SymbolCombobox', () => {
  it('flips aria-expanded on open, shows the placeholder, and emits the picked symbol', async () => {
    const onChange = vi.fn()
    await render(
      <SymbolCombobox
        aria-label="Symbol"
        onValueChange={onChange}
        options={[{ value: 'ES', label: 'ES' }, { value: 'NQ', label: 'NQ' }]}
      />
    )
    const button = document.querySelector('[role="combobox"]') as HTMLButtonElement
    expect(button).toHaveAccessibleName('Symbol')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveTextContent('Select symbol')
    await act(async () => button.click())
    expect(button).toHaveAttribute('aria-expanded', 'true')
    await act(async () => (document.querySelector('[role="option"][data-value="NQ NQ"]') as HTMLElement).click())
    expect(onChange).toHaveBeenCalledWith('NQ')
  })
})

describe('TagMultiSelect', () => {
  it('names remove buttons and emits pruned or extended arrays', async () => {
    const onChange = vi.fn()
    const root = await render(
      <TagMultiSelect
        aria-label="Tags"
        value={['breakout']}
        onValueChange={onChange}
        options={[{ value: 'breakout', label: 'Breakout' }, { value: 'reversal', label: 'Reversal' }]}
      />
    )
    const group = document.querySelector('[aria-label="Tags"]')!
    expect(group).toHaveAttribute('role', 'group')
    const remove = document.querySelector('[aria-label="Remove Breakout"]') as HTMLButtonElement
    await act(async () => remove.click())
    expect(onChange).toHaveBeenCalledWith([])
    await act(async () =>
      root.render(
        <TagMultiSelect
          aria-label="Tags"
          value={[]}
          onValueChange={onChange}
          options={[{ value: 'breakout', label: 'Breakout' }, { value: 'reversal', label: 'Reversal' }]}
        />
      )
    )
    const trigger = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Add tags')!
    await act(async () => trigger.click())
    await act(async () => (document.querySelector('[role="option"][data-value="reversal Reversal"]') as HTMLElement).click())
    expect(onChange).toHaveBeenLastCalledWith(['reversal'])
  })
})

describe('DateTimeTimezoneField', () => {
  it('labels both controls, propagates invalid, and emits changes', async () => {
    const onDateTimeChange = vi.fn()
    const onTimezoneChange = vi.fn()
    await render(
      <DateTimeTimezoneField
        dateTime="2026-08-04T12:30"
        timezone="America/New_York"
        onDateTimeChange={onDateTimeChange}
        onTimezoneChange={onTimezoneChange}
        invalid
        timezones={[
          { value: 'America/New_York', label: 'Eastern Time' },
          { value: 'America/Chicago', label: 'Central Time' },
        ]}
      />
    )
    const dateTime = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
    expect(dateTime).toHaveAccessibleName('Date and time')
    expect(dateTime).toHaveAttribute('aria-invalid', 'true')
    const timezoneTrigger = document.querySelector('[aria-label="Timezone"]') as HTMLButtonElement
    expect(timezoneTrigger).toHaveAttribute('aria-invalid', 'true')
    await act(async () => setInputValue(dateTime, '2026-08-05T09:00'))
    expect(onDateTimeChange).toHaveBeenCalledWith('2026-08-05T09:00')
    await act(async () => timezoneTrigger.click())
    await act(async () => (document.querySelector('[role="option"][data-value="America/Chicago"]') as HTMLElement).click())
    expect(onTimezoneChange).toHaveBeenCalledWith('America/Chicago')
  })
})

describe('FormErrorSummary', () => {
  it('renders nothing without errors', async () => {
    await render(<FormErrorSummary errors={{ symbol: undefined }} />)
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })

  it('summarizes errors with anchors and a default title', async () => {
    await render(<FormErrorSummary errors={{ symbol: 'Symbol is required', amount: 'Amount is invalid' }} />)
    const summary = document.querySelector('[role="alert"]')!
    expect(summary).toHaveTextContent('2 errors need attention')
    expect(summary.querySelector('a[href="#symbol"]')).toHaveTextContent('Symbol is required')
    expect(summary.querySelector('a[href="#amount"]')).toHaveTextContent('Amount is invalid')
  })

  it('honors a custom title', async () => {
    await render(<FormErrorSummary title="Fix the fields" errors={{ symbol: 'Symbol is required' }} />)
    expect(document.querySelector('[role="alert"]')).toHaveTextContent('Fix the fields')
  })
})

describe('EditableTableField', () => {
  async function renderField(props: Partial<React.ComponentProps<typeof EditableTableField>> = {}) {
    const onValueChange = vi.fn()
    const onCommit = vi.fn()
    const onCancel = vi.fn()
    const root = await render(
      <EditableTableField
        aria-label="Size"
        value="ABC"
        onValueChange={onValueChange}
        onCommit={onCommit}
        onCancel={onCancel}
        {...props}
      />
    )
    return { root, onValueChange, onCommit, onCancel }
  }

  it('commits the draft on Enter through onCommit and onValueChange', async () => {
    const { onValueChange, onCommit } = await renderField()
    const input = document.querySelector('input') as HTMLInputElement
    await act(async () => setInputValue(input, 'XYZ'))
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })))
    expect(onValueChange).toHaveBeenCalledWith('XYZ')
    expect(onCommit).toHaveBeenCalledWith('XYZ')
  })

  it('cancels on Escape without emitting onValueChange and restores the draft', async () => {
    const { onValueChange, onCommit, onCancel } = await renderField()
    const input = document.querySelector('input') as HTMLInputElement
    await act(async () => setInputValue(input, 'XYZ'))
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onValueChange).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('ABC')
  })

  it('commits a changed draft on blur and ignores an unchanged one', async () => {
    const { onValueChange, onCommit, onCancel } = await renderField()
    const input = document.querySelector('input') as HTMLInputElement
    await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    await act(async () => setInputValue(input, 'XYZ'))
    await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onValueChange).toHaveBeenCalledWith('XYZ')
    expect(onCommit).toHaveBeenCalledWith('XYZ')
  })

  it('marks invalid fields and stays focusable', async () => {
    const { onValueChange } = await renderField({ invalid: true })
    const input = document.querySelector('input') as HTMLInputElement
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    await act(async () => input.focus())
    expect(input).toHaveFocus()
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
