import { beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub

const { apiRequestData } = vi.hoisted(() => ({ apiRequestData: vi.fn() }))
const { importTradesThroughApi } = vi.hoisted(() => ({ importTradesThroughApi: vi.fn() }))

vi.mock('@/lib/api/client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api/client')>()
  return { ...mod, apiRequestData }
})

vi.mock('@/lib/api/trade-import-client', () => ({ importTradesThroughApi }))

vi.mock('@/hooks/use-accounts', () => ({
  useAccounts: () => ({
    accounts: [
      {
        id: 'acct-1',
        number: 'ph-1',
        accountType: 'live',
        status: 'active',
        displayName: 'Live Account',
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
    updateAccountInCache: vi.fn(),
  }),
}))

vi.mock('@/store/user-store', () => ({
  useUserStore: (selector: (state: any) => unknown) =>
    selector({
      user: { id: 'user-1' },
      supabaseUser: null,
      setUser: vi.fn(),
      setSupabaseUser: vi.fn(),
    }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/observability/report-error', () => ({
  reportClientError: vi.fn(),
  reportError: vi.fn(),
}))

vi.mock('@/components/ui/editor/lexical-editor', () => ({
  LexicalEditor: () => null,
}))

import { ApiClientError } from '@/lib/api/client'
import ManualTradeForm from '@/app/dashboard/components/import/manual-trade-entry/manual-trade-form'

const fullValues = {
  accountNumber: 'ph-1',
  instrument: 'NQ',
  quantity: 1,
  side: 'LONG',
  entryPrice: '100',
  closePrice: '110',
  entryDate: '2026-08-04',
  entryTime: '09:30',
  closeDate: '2026-08-04',
  closeTime: '10:30',
  pnl: 100,
  commission: 0,
  isMissedTrade: false,
  comment: 'preserve me',
}

interface RenderedForm {
  container: HTMLElement
  unmount: () => void
}

async function renderForm(): Promise<RenderedForm> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const queryClient = new QueryClient()
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ManualTradeForm initialValues={fullValues} />
      </QueryClientProvider>
    )
  })
  return {
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

function clickButton(container: HTMLElement, text: string): void {
  const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text))
  expect(button, `expected a button containing "${text}"`).toBeTruthy()
  button!.click()
}

async function goToStep5(container: HTMLElement): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      clickButton(container, 'Next')
    })
  }
}

async function submitForm(container: HTMLElement): Promise<void> {
  await act(async () => {
    const form = container.querySelector('form#manual-trade-form')
    expect(form).toBeTruthy()
    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

describe('manual trade validation UI', () => {
  beforeEach(() => {
    apiRequestData.mockReset()
    importTradesThroughApi.mockReset()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')))
  })

  it('shows an inline alert, preserves the draft, and does not import on blocked validation', async () => {
    apiRequestData.mockRejectedValueOnce(new ApiClientError({ message: 'The selected account could not be found.', status: 404, kind: 'not_found' }))

    const { container, unmount } = await renderForm()
    await goToStep5(container)
    await submitForm(container)

    const alert = container.querySelector('[role="alert"]')
    expect(alert).toBeTruthy()
    expect(alert!.textContent).toContain('The selected account could not be found.')
    expect(importTradesThroughApi).not.toHaveBeenCalled()
    expect(container.textContent).toContain('ph-1')
    expect(container.textContent).toContain('NQ')

    unmount()
  })

  it('retries validation with preserved values and imports only after success', async () => {
    apiRequestData
      .mockRejectedValueOnce(new ApiClientError({ message: 'The selected account could not be found.', status: 404, kind: 'not_found' }))
      .mockResolvedValueOnce({ accountType: 'regular' })
    importTradesThroughApi.mockResolvedValueOnce({ importedCount: 1, meta: { accountName: 'Live Account' } })

    const { container, unmount } = await renderForm()
    await goToStep5(container)
    await submitForm(container)

    expect(container.querySelector('[role="alert"]')).toBeTruthy()

    await act(async () => {
      clickButton(container, 'Retry validation')
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(container.querySelector('[role="alert"]')).toBeFalsy()
    expect(importTradesThroughApi).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('imports the built trade after a valid phase response', async () => {
    apiRequestData.mockResolvedValueOnce({ accountType: 'regular' })
    importTradesThroughApi.mockResolvedValueOnce({ importedCount: 1, meta: { accountName: 'Live Account' } })

    const { container, unmount } = await renderForm()
    await goToStep5(container)
    await submitForm(container)

    expect(importTradesThroughApi).toHaveBeenCalledTimes(1)
    const [call] = importTradesThroughApi.mock.calls[0] as [{ accountId: string; trades: any[] }]
    expect(call.accountId).toBe('acct-1')
    expect(call.trades).toHaveLength(1)
    expect(call.trades[0]).toMatchObject({
      accountNumber: 'ph-1',
      instrument: 'NQ',
      side: 'LONG',
      userId: 'user-1',
    })

    unmount()
  })
})
