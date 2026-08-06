import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub

const { reportClientErrorMock } = vi.hoisted(() => ({ reportClientErrorMock: vi.fn() }))

vi.mock('@/lib/observability/report-error', () => ({
  reportClientError: reportClientErrorMock,
  reportError: vi.fn(),
}))

import FileUpload from '@/app/dashboard/components/import/file-upload'

const roots: Array<ReturnType<typeof createRoot>> = []
const containers: HTMLDivElement[] = []

function render(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => {
    root.render(element)
  })
}

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

function driveFileInput(container: HTMLElement, file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('File input not rendered')
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const VALID_CSV = new File(['date,symbol,quantity,price,pnl\n2026-01-05,ES,1,5000,50'], 'trades.csv', {
  type: 'text/csv',
})

function makeProps() {
  return {
    importType: 'universal' as const,
    setRawCsvData: vi.fn(),
    setCsvData: vi.fn(),
    setHeaders: vi.fn(),
    setStep: vi.fn(),
    setError: vi.fn(),
  }
}

afterEach(() => {
  act(() => {
    roots.splice(0).forEach((root) => root.unmount())
    containers.splice(0).forEach((container) => container.remove())
  })
  window.dispatchEvent(new Event('online'))
})

describe('File upload rejection alert', () => {
  it('shows a dismissible rejection alert for non-CSV files', async () => {
    const props = makeProps()
    const container = document.createElement('div')
    document.body.appendChild(container)
    containers.push(container)
    const root = createRoot(container)
    roots.push(root)
    act(() => {
      root.render(<FileUpload {...props} />)
    })
    await settle()

    driveFileInput(container, new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    await settle()

    const alert = document.querySelector('[data-testid="file-rejection-alert"]')
    expect(alert).toBeTruthy()
    expect(alert?.textContent).toContain('notes.txt')
    expect(alert?.textContent).toContain('only .csv files are supported')

    const dismiss = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Dismiss')
    )
    expect(dismiss).toBeTruthy()
    act(() => {
      dismiss?.click()
    })
    await settle()

    expect(document.querySelector('[data-testid="file-rejection-alert"]')).toBeNull()
  })

  it('blocks drops while offline and surfaces the offline message', async () => {
    const props = makeProps()
    const container = document.createElement('div')
    document.body.appendChild(container)
    containers.push(container)
    const root = createRoot(container)
    roots.push(root)
    act(() => {
      root.render(<FileUpload {...props} />)
    })
    await settle()

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    await settle()

    driveFileInput(container, VALID_CSV)
    await settle()

    const alert = document.querySelector('[data-testid="file-rejection-alert"]')
    expect(alert).toBeTruthy()
    expect(alert?.textContent).toContain('You appear to be offline')
    expect(props.setCsvData).not.toHaveBeenCalled()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await settle()
    expect(props.setCsvData).not.toHaveBeenCalled()
  })
})

beforeEach(() => {
  reportClientErrorMock.mockReset()
})
