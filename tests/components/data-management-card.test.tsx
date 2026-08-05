import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/query-keys'

const { apiRequestData, reportClientErrorMock, toast, routerMock, SCOPE, searchParamsMock, clearParams } = vi.hoisted(() => {
  const routerMock = { refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }
  const params = new Map<string, string>()
  return {
    apiRequestData: vi.fn(),
    reportClientErrorMock: vi.fn(),
    toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn(), loading: vi.fn() },
    routerMock,
    SCOPE: { surface: 'authenticated', userId: 'user-1' },
    searchParamsMock: {
      get: (key: string) => params.get(key) ?? null,
      getAll: (key: string) => {
        const value = params.get(key)
        return value ? [value] : []
      },
      toString: () => Array.from(params.entries()).map(([key, value]) => `${key}=${value}`).join('&'),
    },
    clearParams: () => { params.clear() },
  }
})

vi.mock('@/lib/api/client', () => ({ apiRequestData, apiRequest: apiRequestData }))

vi.mock('@/lib/observability/report-error', () => ({
  reportClientError: reportClientErrorMock,
  reportError: vi.fn(),
}))

vi.mock('@/lib/query/use-query-scope', () => ({
  useQueryScope: () => SCOPE,
  isScopeReady: () => true,
}))

vi.mock('@/store/user-store', () => ({
  useUserStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
}))

vi.mock('@/context/data-provider', () => ({
  useData: () => ({ statistics: {}, isDemoMode: false }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock,
}))

vi.mock('sonner', () => ({ toast }))

import { DataManagementCard } from '@/app/dashboard/data/components/data-management/data-management-card'

const LIVE_ACCOUNT = {
  id: 'acc-1',
  number: 'LIVE-1',
  name: 'Live Trading',
  displayName: 'Live Trading',
  accountType: 'live',
  status: 'active',
  tradeCount: 10,
  currentPhase: 0,
  currentPhaseDetails: null,
}

const PROP_PHASE_1 = {
  id: 'phase-a',
  number: 'CH-1',
  name: 'Main Challenge',
  displayName: 'Main Challenge',
  accountType: 'prop-firm',
  status: 'active',
  tradeCount: 5,
  currentPhase: 1,
  propfirm: 'FTMO',
  currentPhaseDetails: { phaseId: 'FTMO-P1', phaseNumber: 1, status: 'active', masterAccountId: 'master-1', evaluationType: 'Two Step' },
}

const PROP_PHASE_2 = {
  id: 'phase-b',
  number: 'CH-2',
  name: 'Main Challenge',
  displayName: 'Main Challenge',
  accountType: 'prop-firm',
  status: 'active',
  tradeCount: 3,
  currentPhase: 2,
  propfirm: 'FTMO',
  currentPhaseDetails: { phaseId: 'FTMO-P2', phaseNumber: 2, status: 'active', masterAccountId: 'master-1', evaluationType: 'Two Step' },
}

const ACCOUNTS_RESPONSE = { data: [LIVE_ACCOUNT, PROP_PHASE_1, PROP_PHASE_2] }

const roots: Array<ReturnType<typeof createRoot>> = []

afterEach(async () => {
  await act(async () => roots.splice(0).forEach((root) => root.unmount()))
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

beforeEach(() => {
  clearParams()
})

async function render(element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  roots.push(root)
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: queryClient }, element))
  })
  await settle()
  return queryClient
}

async function settle() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

function buttonContaining(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(text)
  )
  if (!button) throw new Error(`Button containing "${text}" not found`)
  return button as HTMLButtonElement
}

describe('data management card', () => {
  it('loads accounts through the scoped dataManagementAccounts query', async () => {
    apiRequestData.mockResolvedValue(ACCOUNTS_RESPONSE)
    const queryClient = await render(<DataManagementCard />)

    expect(apiRequestData).toHaveBeenCalledWith(
      '/api/v1/data-management/accounts',
      expect.objectContaining({
        operation: 'load-data-management-accounts',
        signal: expect.anything(),
      })
    )

    const keys = queryClient.getQueryCache().getAll().map((query) => query.queryKey)
    expect(keys).toContainEqual(queryKeys.dataManagementAccounts(SCOPE))

    expect(document.body.textContent).toContain('Live Trading')
    expect(document.body.textContent).toContain('Main Challenge')
    expect(document.body.textContent).toContain('FTMO')
    expect(document.body.textContent).toContain('CH-1')
    expect(document.body.textContent).toContain('CH-2')
  })

  it('renames an account through the rename mutation and invalidates dependent domains', async () => {
    apiRequestData.mockResolvedValue(ACCOUNTS_RESPONSE)
    const queryClient = await render(<DataManagementCard />)

    const renameButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Rename account CH-1'
    )
    if (!renameButton) throw new Error('Rename button not found')
    await act(async () => { renameButton.click() })
    await settle()

    const input = document.querySelector('#newNumber') as HTMLInputElement | null
    if (!input) throw new Error('New number input not found')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      setter?.call(input, 'NEW-1')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await settle()

    await act(async () => { buttonContaining('Rename').click() })
    await settle()

    expect(apiRequestData).toHaveBeenCalledWith(
      '/api/v1/data-management/accounts',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ oldAccountNumber: 'CH-1', newAccountNumber: 'NEW-1' }),
        operation: 'rename-data-management-account',
        retry: { mode: 'never' },
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Account renamed', expect.anything())
    expect(reportClientErrorMock).not.toHaveBeenCalled()
  })

  it('deletes selected accounts through deleteAccountRequest and invalidates dependent domains', async () => {
    apiRequestData.mockResolvedValue(ACCOUNTS_RESPONSE)
    await render(<DataManagementCard />)

    const checkboxes = document.querySelectorAll('button[role="checkbox"]')
    await act(async () => { (checkboxes[1] as HTMLButtonElement).click() })
    await settle()

    await act(async () => { buttonContaining('Delete selected (1)').click() })
    await settle()

    await act(async () => { buttonContaining('Delete selected accounts').click() })
    await settle()

    expect(apiRequestData).toHaveBeenCalledWith(
      '/api/v1/accounts/acc-1',
      expect.objectContaining({
        method: 'DELETE',
        operation: 'delete-live-account',
        retry: { mode: 'never' },
      })
    )
    expect(routerMock.refresh).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Accounts Deleted', expect.anything())
  })

  it('reports load failures through reportClientError', async () => {
    apiRequestData.mockRejectedValue(new Error('load failed'))
    await render(<DataManagementCard />)

    expect(reportClientErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operation: 'load-data-management-accounts', route: '/api/v1/data-management/accounts' })
    )
  })
})
