import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { reportClientErrorMock, reportErrorMock } = vi.hoisted(() => ({
  reportClientErrorMock: vi.fn(),
  reportErrorMock: vi.fn(),
}))

vi.mock('@/lib/observability/report-error', () => ({
  reportClientError: reportClientErrorMock,
  reportError: reportErrorMock,
}))

import { SharedReportView } from '@/app/reports/shared/[slug]/shared-report-view'
import SharedReportLoading from '@/app/reports/shared/[slug]/loading'
import SharedReportError from '@/app/reports/shared/[slug]/error'
import {
  classifySharedReportState,
  parseSharedReportSnapshot,
  type SharedReportRowLike,
} from '@/lib/reports/shared-report'

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
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const SNAPSHOT = {
  reportData: {
    psychMetrics: {
      totalNetPnL: 1240.5,
      avgWin: 85.2,
      avgLoss: -40.1,
      profitFactor: 2.4,
      expectancy: 12.4,
      maxDrawdown: -310.2,
      recoveryFactor: 4,
      rrEfficiency: 1.8,
      consistencyScore: 78,
      totalRMultiple: 21.5,
      peakEquity: 5020.1,
    },
    tradingActivity: {
      totalTrades: 42,
      winRate: 64.3,
      tradingDaysActive: 18,
      mostTradedDay: 'Friday',
      mostProfitableDay: 'Tuesday',
      mostLosingDay: 'Monday',
    },
    sessionPerformance: {
      europe: { name: 'Europe', range: '08:00 - 12:00', trades: 10, wins: 7, pnl: 120.5, maxDD: -30.2 },
    },
    rMultipleDataQuality: { tradesWithStopLoss: 38, totalTrades: 42, percentageComplete: 90.5 },
  },
}

function row(overrides: Partial<SharedReportRowLike> = {}): SharedReportRowLike {
  return {
    id: 'r1',
    slug: 'abc123abc1',
    title: 'Q3 Performance',
    dateFrom: '2026-01-01T00:00:00.000Z',
    dateTo: '2026-03-31T00:00:00.000Z',
    isPublic: true,
    expiresAt: null,
    snapshot: SNAPSHOT,
    viewCount: 3,
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

const NOW = new Date('2026-04-15T00:00:00.000Z')

describe('shared report state classification', () => {
  it('classifies a missing row as unavailable', () => {
    expect(classifySharedReportState(undefined, NOW)).toEqual({ status: 'unavailable' })
    expect(classifySharedReportState(null, NOW)).toEqual({ status: 'unavailable' })
  })

  it('classifies a revoked report by isPublic=false', () => {
    expect(classifySharedReportState(row({ isPublic: false }), NOW)).toEqual({ status: 'revoked' })
  })

  it('classifies an expired report by expiresAt in the past', () => {
    const state = classifySharedReportState(
      row({ expiresAt: new Date('2026-04-01T00:00:00.000Z') }),
      NOW,
    )
    expect(state).toEqual({ status: 'expired' })
  })

  it('keeps a non-expired report valid', () => {
    const state = classifySharedReportState(
      row({ expiresAt: new Date('2026-06-01T00:00:00.000Z') }),
      NOW,
    )
    expect(state.status).toBe('valid')
  })

  it('classifies a non-object snapshot as malformed', () => {
    expect(classifySharedReportState(row({ snapshot: 'not-an-object' }), NOW)).toEqual({ status: 'malformed' })
    expect(classifySharedReportState(row({ snapshot: null }), NOW)).toEqual({ status: 'malformed' })
  })

  it('classifies an object snapshot without usable segments as unavailable', () => {
    expect(classifySharedReportState(row({ snapshot: { foo: 1 } }), NOW)).toEqual({ status: 'unavailable' })
    expect(classifySharedReportState(row({ snapshot: { reportData: { psychMetrics: { totalNetPnL: 5 } } } }), NOW)).toEqual({ status: 'unavailable' })
  })

  it('normalizes nested reportData and flat fallback snapshots', () => {
    expect(parseSharedReportSnapshot(SNAPSHOT)?.psych).toMatchObject({ totalNetPnL: 1240.5 })
    expect(parseSharedReportSnapshot(SNAPSHOT)?.activity).toMatchObject({ totalTrades: 42 })
    expect(parseSharedReportSnapshot(SNAPSHOT)?.sessions).toBeTruthy()
    expect(parseSharedReportSnapshot(SNAPSHOT)?.rDataQuality).toMatchObject({ percentageComplete: 90.5 })

    const flat = parseSharedReportSnapshot({
      psychMetrics: { totalNetPnL: 9 },
      tradingActivity: { totalTrades: 2 },
    })
    expect(flat?.psych).toMatchObject({ totalNetPnL: 9 })
    expect(flat?.activity).toMatchObject({ totalTrades: 2 })
  })

  it('produces a typed valid state with the normalized snapshot', () => {
    const state = classifySharedReportState(row(), NOW)
    expect(state).toMatchObject({ status: 'valid' })
    if (state.status !== 'valid') return
    expect(state.report).toMatchObject({
      slug: 'abc123abc1',
      title: 'Q3 Performance',
      viewCount: 3,
    })
    expect(state.report.content.psych).toBeTruthy()
    expect(state.report.content.activity).toBeTruthy()
  })
})

describe('shared report view states', () => {
  const fetchMock = vi.fn()
  const routes = new Map<string, () => Promise<Response>>()

  function stubFetch() {
    routes.clear()
    fetchMock.mockReset()
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      const handler = routes.get(`${method} ${url}`)
      if (!handler) {
        return Promise.resolve(jsonResponse({ success: false, error: 'Unexpected request' }, 404))
      }
      return handler()
    })
    vi.stubGlobal('fetch', fetchMock)
  }

  beforeEach(() => {
    reportClientErrorMock.mockReset()
    reportErrorMock.mockReset()
    stubFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    act(() => {
      roots.splice(0).forEach((root) => root.unmount())
      containers.splice(0).forEach((container) => container.remove())
    })
  })

  it('renders the typed snapshot for a valid report', async () => {
    routes.set('POST /api/v1/reports/shared/abc123abc1/view', () =>
      Promise.resolve(jsonResponse({ success: true, data: { viewCount: 3, counted: false } }))
    )
    const state = classifySharedReportState(row(), NOW)
    render(<SharedReportView state={state} />)
    await settle()

    expect(document.body.textContent).toContain('Q3 Performance')
    expect(document.body.textContent).toContain('+$1,240.50')
    expect(document.body.textContent).toContain('42')
    expect(document.body.textContent).toContain('64.3%')
    expect(document.body.textContent).toContain('2.4')
    expect(document.body.textContent).toContain('3 views')
    expect(document.body.textContent).toContain('Europe')
    expect(document.body.textContent).not.toContain('Report data unavailable')
  })

  it('records the view count mutation through the canonical api client', async () => {
    routes.set('POST /api/v1/reports/shared/abc123abc1/view', () =>
      Promise.resolve(jsonResponse({ success: true, data: { viewCount: 6, counted: true } }))
    )
    const state = classifySharedReportState(row(), NOW)
    render(<SharedReportView state={state} />)
    await settle()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/reports/shared/abc123abc1/view',
      expect.objectContaining({ method: 'POST', operation: 'record-shared-report-view', cache: 'no-store' }),
    )
    expect(document.body.textContent).toContain('6 views')
  })

  it('keeps the initial count when the view-count mutation fails', async () => {
    routes.set('POST /api/v1/reports/shared/abc123abc1/view', () =>
      Promise.resolve(jsonResponse({ success: false, error: { message: 'Boom' } }, 500))
    )
    const state = classifySharedReportState(row(), NOW)
    render(<SharedReportView state={state} />)
    await settle()

    expect(document.body.textContent).toContain('3 views')
    expect(reportClientErrorMock).toHaveBeenCalled()
  })

  it('renders the expired state without firing the view-count mutation', async () => {
    const state = classifySharedReportState(
      row({ expiresAt: new Date('2026-04-01T00:00:00.000Z') }),
      NOW,
    )
    render(<SharedReportView state={state} />)
    await settle()

    expect(document.body.textContent).toContain('Report expired')
    expect(document.body.textContent).toContain('This shared report has expired and is no longer available.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders the revoked state without firing the view-count mutation', async () => {
    render(<SharedReportView state={{ status: 'revoked' }} />)
    await settle()

    expect(document.body.textContent).toContain('Report revoked')
    expect(document.body.textContent).toContain('The owner has revoked access to this shared report.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders the malformed state without firing the view-count mutation', async () => {
    render(<SharedReportView state={{ status: 'malformed' }} />)
    await settle()

    expect(document.body.textContent).toContain('Report unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders the unavailable state without firing the view-count mutation', async () => {
    render(<SharedReportView state={{ status: 'unavailable' }} />)
    await settle()

    expect(document.body.textContent).toContain('Report data unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('shared report local boundaries', () => {
  afterEach(() => {
    act(() => {
      roots.splice(0).forEach((root) => root.unmount())
      containers.splice(0).forEach((container) => container.remove())
    })
  })

  it('renders a loading skeleton for the shared route', () => {
    render(React.createElement(SharedReportLoading))
    expect(document.querySelector('[role="status"]')).toBeTruthy()
    expect(document.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders the local error boundary with retry', async () => {
    const reset = vi.fn()
    render(
      <SharedReportError
        error={Object.assign(new Error('Database unreachable'), { digest: 'digest-1' })}
        reset={reset}
      />,
    )
    await settle()

    expect(document.querySelector('[role="alert"]')).toBeTruthy()
    expect(document.body.textContent).toContain('This section could not load')
    expect(document.body.textContent).toContain('Reference: digest-1')
    expect(reportErrorMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { segment: 'reports-shared' } }),
    )
    const retry = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Try again'))
    act(() => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(reset).toHaveBeenCalled()
  })
})
