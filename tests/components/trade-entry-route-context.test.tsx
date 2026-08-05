import { beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub

const { routerPush, useQueryMock, paramsRef } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  useQueryMock: vi.fn(),
  paramsRef: { current: new URLSearchParams() },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => paramsRef.current,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@/lib/query/use-query-scope', () => ({
  useQueryScope: () => ({ surface: 'authenticated', userId: 'user-1' }),
  isScopeReady: () => true,
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

vi.mock('@/hooks/use-accounts', () => ({
  useAccounts: () => ({
    accounts: [],
    isLoading: false,
    refetch: vi.fn(),
    updateAccountInCache: vi.fn(),
  }),
  invalidateAccountsCache: vi.fn(),
}))

vi.mock('@/components/ui/editor/lexical-editor', () => ({
  LexicalEditor: () => null,
}))

import TradeEntryPageClient from '@/app/dashboard/trades/new/trade-entry-page-client'

const PROP_FIRM_PARAMS = 'origin=prop-firm&propFirmAccountId=p1&returnTo=%2Fdashboard%2Fprop-firm%2Faccounts%2Fp1%2Ftrades'

interface RenderedPage {
  container: HTMLElement
  unmount: () => void
}

async function renderPage(): Promise<RenderedPage> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(<TradeEntryPageClient />)
  })
  return {
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

describe('trade entry route context validation', () => {
  beforeEach(() => {
    routerPush.mockReset()
    useQueryMock.mockReset()
    useQueryMock.mockReturnValue({ data: undefined, isPending: false, isError: false, error: null })
    paramsRef.current = new URLSearchParams()
  })

  it('renders the form without validation when no prop firm account is in context', async () => {
    const { container, unmount } = await renderPage()

    expect(useQueryMock).toHaveBeenCalled()
    expect(useQueryMock.mock.calls[0][0].enabled).toBe(false)
    expect(container.querySelector('form#manual-trade-form')).toBeTruthy()
    expect(container.textContent).not.toContain('Account not found or inaccessible')

    unmount()
  })

  it('shows a busy state while the prop firm account loads', async () => {
    paramsRef.current = new URLSearchParams(PROP_FIRM_PARAMS)
    useQueryMock.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null })

    const { container, unmount } = await renderPage()

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('form#manual-trade-form')).toBeFalsy()

    unmount()
  })

  it('shows the not-found state and returns to the trades route when the account is missing', async () => {
    paramsRef.current = new URLSearchParams(PROP_FIRM_PARAMS)
    useQueryMock.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('not found') })

    const { container, unmount } = await renderPage()

    expect(container.textContent).toContain('Account not found or inaccessible')
    expect(container.querySelector('form#manual-trade-form')).toBeFalsy()
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Return to trades'))
    expect(button).toBeTruthy()
    await act(async () => {
      button!.click()
    })
    expect(routerPush).toHaveBeenCalledWith('/dashboard/prop-firm/accounts/p1/trades')

    unmount()
  })

  it('renders the form when the prop firm account exists', async () => {
    paramsRef.current = new URLSearchParams(PROP_FIRM_PARAMS)
    useQueryMock.mockReturnValue({ data: { account: { id: 'p1' } }, isPending: false, isError: false, error: null })

    const { container, unmount } = await renderPage()

    expect(container.querySelector('form#manual-trade-form')).toBeTruthy()
    expect(container.textContent).not.toContain('Account not found or inaccessible')

    unmount()
  })
})
