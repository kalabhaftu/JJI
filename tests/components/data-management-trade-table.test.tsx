import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/query-keys'

const { apiRequest, apiRequestData, reportClientErrorMock, toast, routerMock, SCOPE, searchParamsMock, setParam, clearParams } = vi.hoisted(() => {
  const routerMock = { refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }
  const params = new Map<string, string>()
  return {
    apiRequest: vi.fn().mockResolvedValue({ data: { updated: 1 } }),
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
    setParam: (key: string, value: string) => { params.set(key, value) },
    clearParams: () => { params.clear() },
  }
})

vi.mock('@/lib/api/client', () => ({ apiRequest, apiRequestData }))

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

vi.mock('@/hooks/use-news-events', () => ({
  useNewsEvents: () => ({ newsEvents: [], getNewsById: () => undefined, isLoading: false, error: null }),
}))

vi.mock('@/hooks/use-trading-models', () => ({
  useTradingModels: () => ({ tradingModels: [], isLoading: false, error: null }),
}))

vi.mock('@/context/tags-provider', () => ({
  useTags: () => ({ tags: [] }),
}))

import TradeTable from '@/app/dashboard/data/components/data-management/trade-table'
import { TooltipProvider } from '@/components/ui/tooltip'

const TRADE_1 = {
  id: 'trade-1',
  symbol: 'ES',
  instrument: 'ES',
  side: 'long',
  quantity: 1,
  entryDate: '2026-01-05T10:00:00Z',
  closeDate: '2026-01-05T15:00:00Z',
  entryPrice: '5000',
  exitPrice: '5050',
  closePrice: '5050',
  pnl: 50,
  accountNumber: 'ACC-1',
  accountId: 'acc-1',
  chartLinks: null,
  chartLinksList: [],
  tags: [],
}

const TRADE_2 = {
  id: 'trade-2',
  symbol: 'NQ',
  instrument: 'NQ',
  side: 'short',
  quantity: 2,
  entryDate: '2026-01-06T10:00:00Z',
  closeDate: '2026-01-06T15:00:00Z',
  entryPrice: '20000',
  exitPrice: '19950',
  closePrice: '19950',
  pnl: -25,
  accountNumber: 'ACC-1',
  accountId: 'acc-1',
  chartLinks: null,
  chartLinksList: [],
  tags: [],
}

const QUERY_STRING = 'pageLimit=50&pageOffset=0&includeStats=false&includeCalendar=false'
const PAGE_1_RESPONSE = { trades: [TRADE_1, TRADE_2], total: 60 }

const roots: Array<ReturnType<typeof createRoot>> = []

afterEach(async () => {
  await act(async () => roots.splice(0).forEach((root) => root.unmount()))
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

beforeEach(() => {
  clearParams()
  apiRequest.mockResolvedValue({ data: { updated: 1 } })
})

async function render(element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  roots.push(root)
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: queryClient }, createElement(TooltipProvider, null, element))
    )
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

function buttonExact(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === text
  )
  if (!button) throw new Error(`Button "${text}" not found`)
  return button as HTMLButtonElement
}

function buttonContaining(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(text)
  )
  if (!button) throw new Error(`Button containing "${text}" not found`)
  return button as HTMLButtonElement
}

function checkboxForRow(instrument: string): HTMLButtonElement {
  const row = Array.from(document.querySelectorAll('tbody tr')).find((candidate) =>
    candidate.textContent?.includes(instrument)
  )
  if (!row) throw new Error(`Row for "${instrument}" not found`)
  const checkbox = row.querySelector('button[role="checkbox"]')
  if (!checkbox) throw new Error(`Checkbox for "${instrument}" not found`)
  return checkbox as HTMLButtonElement
}

describe('data management trade table', () => {
  it('loads trades through the canonical scoped trades query', async () => {
    apiRequestData.mockResolvedValue(PAGE_1_RESPONSE)
    const queryClient = await render(<TradeTable />)

    expect(apiRequestData).toHaveBeenCalledWith(
      `/api/v1/trades?${QUERY_STRING}`,
      expect.objectContaining({
        operation: 'load-filtered-trades',
        signal: expect.anything(),
      })
    )

    const keys = queryClient.getQueryCache().getAll().map((query) => query.queryKey)
    const tradesKey = queryKeys.trades(SCOPE, QUERY_STRING)
    expect(keys).toContainEqual(tradesKey)
    expect(keys.some((key) => key[0] === 'data-management')).toBe(false)

    const rows = document.querySelectorAll('tbody tr')
    expect(rows.length).toBe(2)
    expect(document.body.textContent).toContain('ES')
    expect(document.body.textContent).toContain('NQ')
  })

  it('keeps the previous page visible while fetching the next page', async () => {
    apiRequestData.mockResolvedValue(PAGE_1_RESPONSE)
    await render(<TradeTable />)

    await act(async () => { buttonExact('Next').click() })
    await settle()

    expect(apiRequestData).toHaveBeenLastCalledWith(
      '/api/v1/trades?pageLimit=50&pageOffset=50&includeStats=false&includeCalendar=false',
      expect.objectContaining({ operation: 'load-filtered-trades' })
    )
    expect(document.querySelectorAll('tbody tr').length).toBe(2)
  })

  it('deletes selected trades through the canonical batch-delete mutation', async () => {
    apiRequestData.mockResolvedValue(PAGE_1_RESPONSE)
    await render(<TradeTable />)

    await act(async () => { checkboxForRow('NQ').click() })
    await settle()

    await act(async () => { buttonContaining('Delete (1)').click() })
    await settle()

    await act(async () => { buttonExact('Delete trades').click() })
    await settle()

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/trades/batch/delete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tradeIds: ['trade-2'] }),
      })
    )
    expect(routerMock.refresh).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Trades Deleted', expect.anything())
    expect(reportClientErrorMock).not.toHaveBeenCalled()
  })

  it('saves trade edits through the canonical batch update mutation', async () => {
    setParam('view', 'edit')
    setParam('tradeId', 'trade-1')
    apiRequestData.mockResolvedValue(PAGE_1_RESPONSE)
    await render(<TradeTable />)

    await act(async () => { buttonExact('Save Changes').click() })
    await settle()

    const updateCall = apiRequest.mock.calls.find(([url]) => url === '/api/v1/trades/batch/update')
    expect(updateCall).toBeDefined()
    expect(updateCall![0]).toBe('/api/v1/trades/batch/update')
    const parsedBody = JSON.parse(updateCall![1].body)
    expect(parsedBody).toEqual({ tradeIds: ['trade-1'], update: expect.objectContaining({ modelId: null }) })
    expect(toast.success).toHaveBeenCalledWith('Trade Updated', expect.anything())
    expect(routerMock.refresh).toHaveBeenCalled()
  })

  it('reports load failures through reportClientError', async () => {
    apiRequestData.mockRejectedValue(new Error('load failed'))
    await render(<TradeTable />)

    expect(reportClientErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operation: 'load-data-management-trades', route: '/api/v1/trades' })
    )
    expect(document.body.textContent).toContain('No trades yet')
  })
})