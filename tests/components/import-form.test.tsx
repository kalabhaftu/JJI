import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub

const {
  toastMock,
  emitTourEventMock,
  reportClientErrorMock,
  refreshTradesMock,
  invalidateQueriesMock,
  importTradesThroughApiMock,
} = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  emitTourEventMock: vi.fn(),
  reportClientErrorMock: vi.fn(),
  refreshTradesMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
  importTradesThroughApiMock: vi.fn(),
}))

const accountsMock = vi.hoisted(() => ({
  accounts: [
    {
      id: 'acc-1',
      number: '10001',
      displayName: 'Live Account',
      accountType: 'live',
      startingBalance: 10000,
      status: 'active',
      isArchived: false,
    },
  ],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
}))
const realtimeAccountsMock = vi.hoisted(() => ({ isConnected: true }))

vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('@/lib/tours/events', () => ({ emitTourEvent: emitTourEventMock }))
vi.mock('@/lib/observability/report-error', () => ({
  reportClientError: reportClientErrorMock,
  reportError: vi.fn(),
}))
vi.mock('@/context/data-provider', () => ({
  useData: () => ({ refreshTrades: refreshTradesMock, statistics: {} }),
}))
vi.mock('@/lib/query/use-query-scope', () => ({
  useQueryScope: () => ({ surface: 'authenticated', userId: 'user-1' }),
}))
vi.mock('@/store/user-store', () => ({
  useUserStore: (selector: (state: { user: { id: string } | null; supabaseUser: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' }, supabaseUser: null }),
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}))
vi.mock('@/lib/api/trade-import-client', () => ({
  importTradesThroughApi: importTradesThroughApiMock,
}))
vi.mock('@/hooks/use-accounts', () => ({
  useAccounts: () => accountsMock,
}))
vi.mock('@/hooks/use-realtime-accounts', () => ({
  useRealtimeAccounts: () => realtimeAccountsMock,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@ai-sdk/react', () => ({
  experimental_useObject: () => ({
    object: null,
    submit: vi.fn(),
    isLoading: false,
    error: undefined,
  }),
}))

import ImportButton from '@/app/dashboard/components/import/import-button'

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

async function settle(ms = 20) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

async function waitForStepChange() {
  await settle(450)
  for (let i = 0; i < 4; i++) {
    await settle(0)
  }
}

function clickSelector(selector: string) {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) throw new Error(`Element "${selector}" not found`)
  act(() => {
    element.click()
  })
}

function driveFileInput(file: File) {
  const input = document.querySelector<HTMLInputElement>('[data-tour="file-upload-dropzone"] input[type="file"]')
  if (!input) throw new Error('File input not rendered')
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const VALID_CSV = new File(
  ['Symbol,Open time,Quantity,Entry price,Exit price,P/L\nES,2026-01-05 09:30,1,5000,5010,10\n'],
  'trades.csv',
  { type: 'text/csv' }
)

const SUCCESS_JOB = {
  status: 'completed',
  importedCount: 1,
  totalItems: 1,
  meta: {},
}

beforeEach(() => {
  toastMock.success.mockReset()
  toastMock.error.mockReset()
  toastMock.info.mockReset()
  emitTourEventMock.mockReset()
  reportClientErrorMock.mockReset()
  refreshTradesMock.mockReset()
  invalidateQueriesMock.mockReset()
  importTradesThroughApiMock.mockReset()
})

afterEach(() => {
  act(() => {
    roots.splice(0).forEach((root) => root.unmount())
    containers.splice(0).forEach((container) => container.remove())
  })
  window.dispatchEvent(new Event('online'))
})

describe('Import dialog offline banner', () => {
  it('shows the offline banner while offline and hides it when reconnecting', async () => {
    render(<ImportButton />)
    await settle()

    clickSelector('#import-data')
    await waitForStepChange()

    expect(document.body.textContent).not.toContain("You're offline")

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    await settle()

    const banner = document.querySelector('[role="alert"]')
    expect(banner).toBeTruthy()
    expect(banner?.textContent).toContain("You're offline")

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await settle()

    expect(document.querySelector('[role="alert"]')).toBeNull()
  })
})

describe('Import save failure and retry', () => {
  it('shows the phase transition panel with Retry and recovers on retry', async () => {
    importTradesThroughApiMock
      .mockRejectedValueOnce(new Error('A phase transition is required for this account'))
      .mockResolvedValueOnce(SUCCESS_JOB)

    render(<ImportButton />)
    await settle()

    clickSelector('#import-data')
    await waitForStepChange()

    clickSelector('[data-tour="platform-item-universal"]')
    await settle(100)

    clickSelector('[data-tour="import-next-btn"]')
    await waitForStepChange()

    expect(document.querySelector('[data-tour="file-upload-dropzone"]')).toBeTruthy()

    driveFileInput(VALID_CSV)
    await settle(600)
    await settle(600)

    expect(document.querySelector('[data-tour="import-account-card"]')).toBeTruthy()

    clickSelector('[data-tour="import-account-card"]')
    await settle()

    clickSelector('[data-tour="import-next-btn"]')
    await waitForStepChange()
    await waitForStepChange()

    const saveButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save Trades')
    )
    expect(saveButton).toBeTruthy()
    act(() => {
      saveButton?.click()
    })
    await settle(600)

    expect(toastMock.error).toHaveBeenCalledWith(
      'Phase Transition Required',
      expect.objectContaining({ description: expect.stringContaining('phase transition') })
    )
    expect(reportClientErrorMock).toHaveBeenCalled()
    expect(importTradesThroughApiMock).toHaveBeenCalledTimes(1)

    const panel = document.body.textContent
    expect(panel).toContain('Phase Transition Required')

    const retryButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Retry')
    )
    expect(retryButton).toBeTruthy()
    act(() => {
      retryButton?.click()
    })
    await settle(600)

    expect(importTradesThroughApiMock).toHaveBeenCalledTimes(2)
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(2)
    expect(refreshTradesMock).toHaveBeenCalled()
    expect(toastMock.success).toHaveBeenCalledWith('Import Successful', expect.anything())
    expect(emitTourEventMock).toHaveBeenCalledWith('import.succeeded')
  }, 30_000)
})