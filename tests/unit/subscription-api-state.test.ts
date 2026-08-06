import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { toastMock, reportClientErrorMock, reportErrorMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  reportClientErrorMock: vi.fn(),
  reportErrorMock: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('@/lib/observability/report-error', () => ({
  reportClientError: reportClientErrorMock,
  reportError: reportErrorMock,
}))
vi.mock('@/context/theme-provider', () => ({
  useTheme: () => ({
    theme: 'dark',
    accentPack: 'classic',
    widgetStyle: 'default',
    chartStyle: 'smooth',
    setTheme: vi.fn(),
    setAccentPack: vi.fn(),
    setWidgetStyle: vi.fn(),
    setChartStyle: vi.fn(),
  }),
}))
vi.mock('@/context/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'user@test.com' }, isLoading: false }),
}))
vi.mock('@/context/tour-context', () => ({
  useTour: () => ({ startTour: vi.fn(), isActive: false }),
}))
vi.mock('@/server/auth/providers', () => ({
  signOut: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}))

import SettingsPage from '@/app/dashboard/settings/page'
import { defaultAiSettings } from '@/app/dashboard/settings/components/settings-config'
import type { SettingsSubscriptionData } from '@/app/dashboard/settings/components/settings-types'
import { ApiClientError } from '@/lib/api/errors'

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

function mockMatchMedia(matches: boolean) {
  const mql = {
    matches,
    media: '(min-width: 768px)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql)
  return mql
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function findCancelRenewalTrigger(): HTMLButtonElement | null {
  const button = Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.includes('Cancel renewal') && !candidate.closest('[role="alertdialog"]')
  )
  return (button as HTMLButtonElement) ?? null
}

async function clickCancelRenewal() {
  const trigger = findCancelRenewalTrigger()
  if (!trigger) throw new Error('Cancel renewal trigger not found')
  act(() => {
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await settle()
}

async function confirmCancellation() {
  const dialog = document.querySelector('[role="alertdialog"]')
  if (!dialog) throw new Error('Cancellation dialog did not open')
  const action = Array.from(dialog.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes('Cancel renewal')
  )
  if (!action) throw new Error('Cancellation confirm action not found')
  act(() => {
    action.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await settle()
  await settle()
}

const SUBSCRIPTION: SettingsSubscriptionData = {
  hasAccess: true,
  status: 'active',
  provider: 'whop',
  currentPeriodEnd: '2026-09-01T00:00:00.000Z',
  nextPaymentDue: '2026-08-25T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  manageUrl: 'https://whop.com/manage',
}

const PROFILE_PAYLOAD = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@test.com',
  autoAdjustAccountDate: false,
  breakEvenThreshold: 10,
  pnlDisplayMode: 'net',
  aiSettings: defaultAiSettings,
}

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

function stubBackgroundRoutes() {
  routes.set('GET /api/v1/auth/webhook-token', () =>
    Promise.resolve(jsonResponse({ success: true, data: { hasToken: false, token: null } }))
  )
  routes.set('GET /api/auth/profile', () => Promise.resolve(jsonResponse({ success: true, data: PROFILE_PAYLOAD })))
}

function stubSubscriptionStatus(payload: SettingsSubscriptionData | null, status = 200) {
  routes.set('GET /api/v1/billing/status', () =>
    Promise.resolve(jsonResponse({ success: true, data: payload }, status))
  )
}

beforeEach(() => {
  toastMock.success.mockReset()
  toastMock.error.mockReset()
  toastMock.info.mockReset()
  reportClientErrorMock.mockReset()
  reportErrorMock.mockReset()

  const storage = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  })

  mockMatchMedia(true)
  stubFetch()
  stubBackgroundRoutes()
})

afterEach(() => {
  vi.unstubAllGlobals()
  act(() => {
    roots.splice(0).forEach((root) => root.unmount())
    containers.splice(0).forEach((container) => container.remove())
  })
})

describe('settings subscription client state', () => {
  it('renders the subscription loading state while the billing status request is pending', async () => {
    routes.set('GET /api/v1/billing/status', () => new Promise(() => {}))

    render(React.createElement(SettingsPage))
    await settle()
    await settle()

    const subscriptionCard = Array.from(document.querySelectorAll('h3')).find((node) =>
      node.textContent?.includes('Subscription Plan')
    )?.closest('div')
    expect(subscriptionCard).toBeTruthy()
    expect(subscriptionCard?.querySelector('.animate-pulse')).toBeTruthy()
    expect(subscriptionCard?.textContent).not.toContain('Active')
    expect(findCancelRenewalTrigger()).toBeNull()
    expect(toastMock.error).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/billing/status',
      expect.objectContaining({ operation: 'load-subscription' })
    )
  })

  it('loads and renders the subscription success state', async () => {
    stubSubscriptionStatus(SUBSCRIPTION)

    render(React.createElement(SettingsPage))
    await settle()
    await settle()

    expect(document.body.textContent).toContain('Subscription Plan')
    expect(document.body.textContent).toContain('active')
    expect(document.body.textContent).toContain('Active')
    expect(findCancelRenewalTrigger()).toBeTruthy()
    expect(document.body.textContent).toContain('Payment methods & invoices')
    expect(toastMock.error).not.toHaveBeenCalled()
    expect(reportErrorMock).not.toHaveBeenCalled()
  })

  it('surfaces the cancel failure and resets the cancel state without mutating subscription data', async () => {
    stubSubscriptionStatus(SUBSCRIPTION)
    routes.set('POST /api/v1/billing/cancel', () =>
      Promise.resolve(
        jsonResponse(
          {
            success: false,
            error: {
              code: 'WHOP_CANCELLATION_FAILED',
              message: 'We could not cancel the subscription. No local billing state was changed.',
            },
            requestId: 'request-cancel-1',
          },
          502
        )
      )
    )

    render(React.createElement(SettingsPage))
    await settle()
    await settle()

    await clickCancelRenewal()
    await confirmCancellation()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/billing/cancel',
      expect.objectContaining({ method: 'POST', operation: 'cancel-whop-subscription' })
    )
    expect(toastMock.error).toHaveBeenCalledWith(
      'Cancellation failed',
      expect.objectContaining({
        description: 'We could not cancel the subscription. No local billing state was changed.',
      })
    )
    const pageReport = reportClientErrorMock.mock.calls.find(([, ctx]) => ctx?.operation === 'cancel-whop-subscription')
    expect(pageReport).toBeTruthy()
    const [reportedError, context] = pageReport as [unknown, { route?: string }]
    expect(reportedError).toBeInstanceOf(ApiClientError)
    expect(reportedError).toMatchObject({ status: 502 })
    expect(context).toMatchObject({ route: '/dashboard/settings' })
    expect(document.body.textContent).toContain('Managed securely through Whop')
    expect(findCancelRenewalTrigger()).toBeTruthy()
  })

  it('applies the cancel success state and removes the renewal trigger', async () => {
    stubSubscriptionStatus(SUBSCRIPTION)
    routes.set('POST /api/v1/billing/cancel', () =>
      Promise.resolve(
        jsonResponse({
          success: true,
          data: { cancelAtPeriodEnd: true, currentPeriodEnd: '2026-09-01T00:00:00.000Z' },
          message: 'Your subscription will not renew.',
        })
      )
    )

    render(React.createElement(SettingsPage))
    await settle()
    await settle()

    await clickCancelRenewal()
    await confirmCancellation()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/billing/cancel',
      expect.objectContaining({ method: 'POST', operation: 'cancel-whop-subscription' })
    )
    expect(toastMock.success).toHaveBeenCalledWith('Subscription cancellation scheduled', expect.anything())
    expect(document.body.textContent).toContain('Cancels at period end')
    expect(findCancelRenewalTrigger()).toBeNull()
    expect(reportClientErrorMock).not.toHaveBeenCalled()
    expect(reportErrorMock).not.toHaveBeenCalled()
  })

  it('treats a non-envelope 2xx cancel response as a failure and resets cancel state', async () => {
    stubSubscriptionStatus(SUBSCRIPTION)
    routes.set('POST /api/v1/billing/cancel', () => Promise.resolve(jsonResponse({ ok: true, data: {} })))

    render(React.createElement(SettingsPage))
    await settle()
    await settle()

    await clickCancelRenewal()
    await confirmCancellation()

    expect(toastMock.error).toHaveBeenCalledWith('Cancellation failed', expect.anything())
    expect(document.body.textContent).toContain('Managed securely through Whop')
    expect(findCancelRenewalTrigger()).toBeTruthy()
  })
})
