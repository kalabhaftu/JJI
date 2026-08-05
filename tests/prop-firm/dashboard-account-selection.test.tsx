import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/query-keys'

const { apiRequestData, reportClientErrorMock, isDemoSurfaceMock, SCOPE } = vi.hoisted(() => ({
  apiRequestData: vi.fn(),
  reportClientErrorMock: vi.fn(),
  isDemoSurfaceMock: vi.fn(() => false),
  SCOPE: { surface: 'authenticated', userId: 'user-1' },
}))

vi.mock('@/lib/api/client', () => ({ apiRequestData }))

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

vi.mock('@/lib/public-surface-routing', () => ({
  isDemoSurface: isDemoSurfaceMock,
}))

import { useDashboardPropFirmAccount } from '@/hooks/use-dashboard-prop-firm-account'

const ACTIVE_ACCOUNT = {
  id: 'acc-1',
  accountName: 'Main Challenge',
  propFirmName: 'FTMO',
  accountSize: 100000,
  evaluationType: 'Two Step',
  status: 'active',
  currentPhase: 1,
  PhaseAccount: [{ id: 'phase-1', phaseNumber: 1, phaseId: 'FTMO-PHASE-1', status: 'active' }],
}

const SECOND_ACTIVE_ACCOUNT = {
  id: 'acc-2',
  accountName: 'Second Challenge',
  propFirmName: 'FundedNext',
  accountSize: 200000,
  evaluationType: 'Two Step',
  status: 'active',
  currentPhase: 2,
  PhaseAccount: [{ id: 'phase-2', phaseNumber: 2, phaseId: 'FN-PHASE-2', status: 'active' }],
}

const FAILED_ACCOUNT = {
  id: 'acc-failed',
  accountName: 'Failed Challenge',
  propFirmName: 'MyForexFunds',
  accountSize: 50000,
  evaluationType: 'Two Step',
  status: 'failed',
  currentPhase: 1,
  PhaseAccount: [{ id: 'phase-f', phaseNumber: 1, phaseId: 'OLD-CHALLENGE', status: 'failed' }],
}

const INSTANT_ACCOUNT = {
  id: 'acc-instant',
  accountName: 'Instant Funded',
  propFirmName: 'FTMO',
  accountSize: 25000,
  evaluationType: 'Instant Funding',
  status: 'active',
  currentPhase: 1,
  PhaseAccount: [{ id: 'phase-i', phaseNumber: 1, phaseId: 'FTMO-INSTANT', status: 'active' }],
}

const SELECTION_KEY = 'dashboard.propFirmWidgets.selectedMasterAccountId'
const TIMEZONE_KEY = 'dashboard.propFirmWidgets.resetTimezone'

function installLocalStorage() {
  const data = new Map<string, string>()
  const storage = {
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() { return data.size },
  }
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
}

const roots: Array<ReturnType<typeof createRoot>> = []

afterEach(async () => {
  await act(async () => roots.splice(0).forEach((root) => root.unmount()))
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

async function render(hookComponent: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const root = createRoot(
    document.body.appendChild(document.createElement('div'))
  )
  roots.push(root)
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: queryClient }, hookComponent))
  })
  await settle()
  return queryClient
}

function Harness() {
  const hook = useDashboardPropFirmAccount()
  return (
    <div
      data-testid="state"
      data-state={JSON.stringify({
        accounts: hook.accounts.map((a) => a.id),
        selected: hook.selectedMasterAccountId,
        selectedAccount: hook.selectedAccount?.id ?? null,
        resetTimezone: hook.resetTimezone,
        isLoading: hook.isLoading,
        error: hook.error,
      })}
    />
  )
}

function state() {
  const el = document.querySelector('[data-testid="state"]') as HTMLElement | null
  return el ? JSON.parse(el.dataset.state ?? '{}') : {}
}

async function settle() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

async function rerender(hookComponent: React.ReactElement) {
  await act(async () => roots.splice(0).forEach((root) => root.unmount()))
  document.body.innerHTML = ''
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  roots.push(root)
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: queryClient }, hookComponent))
  })
  await settle()
  return queryClient
}
describe('useDashboardPropFirmAccount query ownership', () => {
  beforeEach(() => {
    installLocalStorage()
    apiRequestData.mockResolvedValue([ACTIVE_ACCOUNT, SECOND_ACTIVE_ACCOUNT, FAILED_ACCOUNT, INSTANT_ACCOUNT])
  })

  it('loads the prop firm accounts through the scoped propFirmAccounts query and applies the selectable filter', async () => {
    const queryClient = await render(<Harness />)

    expect(state().accounts).toEqual(['acc-1', 'acc-2', 'acc-failed'])
    expect(state().isLoading).toBe(false)

    expect(apiRequestData).toHaveBeenCalledWith(
      '/api/v1/prop-firm/accounts',
      expect.objectContaining({
        operation: 'load-dashboard-prop-firm-accounts',
        signal: expect.anything(),
      })
    )

    const keys = queryClient.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(queryKeys.propFirmAccounts(SCOPE))
  })

  it('selects the stored active account when present, otherwise falls back to the first truly active account', async () => {
    window.localStorage.setItem(SELECTION_KEY, 'acc-2')
    await render(<Harness />)

    expect(state().selected).toBe('acc-2')
    expect(state().selectedAccount).toBe('acc-2')

    window.localStorage.setItem(SELECTION_KEY, 'acc-failed')

    await rerender(<Harness />)
    expect(state().selected).toBe('acc-1')
    expect(state().selectedAccount).toBe('acc-1')
  })

  it('returns demo accounts without calling the API on a demo surface', async () => {
    isDemoSurfaceMock.mockReturnValue(true)
    try {
      await render(<Harness />)

      expect(apiRequestData).not.toHaveBeenCalled()
      expect(state().accounts).toEqual(['mock-propfirm-1', 'mock-propfirm-failed'])
      expect(state().selected).toBe('mock-propfirm-1')
    } finally {
      isDemoSurfaceMock.mockReturnValue(false)
    }
  })

  it('syncs selection and timezone through the custom widget events', async () => {
    await render(<Harness />)
    expect(state().selected).toBe('acc-1')

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('prop-firm-widget-account-change', { detail: 'acc-failed' })
      )
    })
    expect(state().selected).toBe('acc-failed')

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('prop-firm-widget-timezone-change', { detail: 'America/New_York' })
      )
    })
    expect(state().resetTimezone).toBe('America/New_York')

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: TIMEZONE_KEY,
          newValue: 'Asia/Tokyo',
        })
      )
    })
    expect(state().resetTimezone).toBe('Asia/Tokyo')
  })

  it('exposes the error message and reports it when the request fails', async () => {
    apiRequestData.mockRejectedValue(new Error('network exploded'))
    await render(<Harness />)

    expect(state().error).toBe('network exploded')
    expect(reportClientErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operation: 'load-dashboard-prop-firm-accounts' })
    )
    expect(state().accounts).toEqual([])
  })
})
