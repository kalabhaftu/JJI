import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { subscriptionStoreMock, authStateMock } = vi.hoisted(() => ({
  subscriptionStoreMock: {
    markActive: vi.fn(),
    markTrialing: vi.fn(),
    markInactive: vi.fn(),
    applySessionChange: vi.fn(),
    getSnapshot: vi.fn(() => ({ status: 'unknown' })),
  },
  authStateMock: {
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn(() => ({ status: 'signed-out' })),
  },
}))

vi.mock('@/stores/subscription-store', () => ({
  useSubscriptionStore: Object.assign(() => subscriptionStoreMock, {
    getState: () => subscriptionStoreMock,
  }),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(() => authStateMock, {
    getState: () => authStateMock.getSnapshot(),
  }),
}))

import { syncBillingToAuth, applyAuthToBilling, resetSubscriptionStore } from '@/lib/subscription/subscription-sync'
import { describeBillingStatus } from '@/lib/subscription/billing-status'
import { StatusCard } from '@/components/billing/status-card'

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

function resetMocks() {
  Object.values(subscriptionStoreMock).forEach((m) => {
    if (typeof m === 'function' && m.mockReset) m.mockReset()
  })
  Object.values(authStateMock).forEach((m) => {
    if (typeof m === 'function' && m.mockReset) m.mockReset()
  })
  subscriptionStoreMock.getSnapshot.mockReturnValue({ status: 'unknown' })
  authStateMock.getSnapshot.mockReturnValue({ status: 'signed-out' })
  authStateMock.subscribe.mockReturnValue(() => {})
}

describe('auth -> subscription sync', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('marks active when the auth session is signed-in with billingActive', () => {
    authStateMock.getSnapshot.mockReturnValue({ status: 'signed-in', user: { billingActive: true } })
    applyAuthToBilling()
    expect(subscriptionStoreMock.markActive).toHaveBeenCalledTimes(1)
  })

  it('marks trialing for an active trial', () => {
    authStateMock.getSnapshot.mockReturnValue({
      status: 'signed-in',
      user: { trialActive: true, trialEndsAt: '2026-08-20T00:00:00.000Z' },
    })
    applyAuthToBilling()
    expect(subscriptionStoreMock.markTrialing).toHaveBeenCalledWith('2026-08-20T00:00:00.000Z')
    expect(subscriptionStoreMock.markActive).not.toHaveBeenCalled()
  })

  it('marks inactive for a signed-in session without billing or trial', () => {
    authStateMock.getSnapshot.mockReturnValue({ status: 'signed-in', user: { billingActive: false } })
    applyAuthToBilling()
    expect(subscriptionStoreMock.markInactive).toHaveBeenCalledTimes(1)
  })

  it('marks inactive when signed out', () => {
    authStateMock.getSnapshot.mockReturnValue({ status: 'signed-out' })
    applyAuthToBilling()
    expect(subscriptionStoreMock.markInactive).toHaveBeenCalledTimes(1)
  })

  it('marks inactive when the auth state is unknown or loading', () => {
    authStateMock.getSnapshot.mockReturnValue({ status: 'loading' })
    applyAuthToBilling()
    expect(subscriptionStoreMock.markInactive).toHaveBeenCalledTimes(1)
  })
})

describe('billing -> auth sync', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('applies a session change for active billing', () => {
    syncBillingToAuth({ status: 'active' })
    expect(subscriptionStoreMock.applySessionChange).toHaveBeenCalledWith({
      billingStatus: 'active',
      trialEndsAt: null,
    })
    expect(subscriptionStoreMock.markActive).not.toHaveBeenCalled()
  })

  it('applies a session change for an expired trial', () => {
    syncBillingToAuth({ status: 'expired-trial' })
    expect(subscriptionStoreMock.applySessionChange).toHaveBeenCalledWith({
      billingStatus: 'inactive',
      trialEndsAt: null,
    })
  })

  it('applies a session change for trialing with the end date', () => {
    syncBillingToAuth({ status: 'trialing', trialEndsAt: '2026-08-20T00:00:00.000Z' })
    expect(subscriptionStoreMock.applySessionChange).toHaveBeenCalledWith({
      billingStatus: 'trialing',
      trialEndsAt: '2026-08-20T00:00:00.000Z',
    })
  })

  it('applies a session change for inactive billing', () => {
    syncBillingToAuth({ status: 'inactive' })
    expect(subscriptionStoreMock.applySessionChange).toHaveBeenCalledWith({
      billingStatus: 'inactive',
      trialEndsAt: null,
    })
  })

  it('does not dispatch when no billing session is present', () => {
    syncBillingToAuth(null)
    expect(subscriptionStoreMock.applySessionChange).not.toHaveBeenCalled()
  })
})

describe('subscription store dispatch', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('dispatches markActive for billing status active', () => {
    resetSubscriptionStore({ billingStatus: 'active' })
    expect(subscriptionStoreMock.markActive).toHaveBeenCalledTimes(1)
  })

  it('dispatches markTrialing for trialing billing status', () => {
    resetSubscriptionStore({ billingStatus: 'trialing', trialEndsAt: '2026-08-20T00:00:00.000Z' })
    expect(subscriptionStoreMock.markTrialing).toHaveBeenCalledWith('2026-08-20T00:00:00.000Z')
  })

  it('dispatches markInactive for non-billing statuses', () => {
    resetSubscriptionStore({ billingStatus: 'inactive' })
    resetSubscriptionStore({ billingStatus: 'expired-trial' })
    expect(subscriptionStoreMock.markInactive).toHaveBeenCalledTimes(2)
  })

  it('does not dispatch when billing status is unknown or absent', () => {
    resetSubscriptionStore({ billingStatus: 'unknown' })
    resetSubscriptionStore(undefined)
    expect(subscriptionStoreMock.markActive).not.toHaveBeenCalled()
    expect(subscriptionStoreMock.markTrialing).not.toHaveBeenCalled()
    expect(subscriptionStoreMock.markInactive).not.toHaveBeenCalled()
  })
})

describe('billing status classification', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('classifies an active subscription', () => {
    expect(describeBillingStatus({ status: 'active' })).toEqual({ label: 'Active', badge: 'green' })
  })

  it('classifies an expired trial', () => {
    expect(describeBillingStatus({ status: 'expired-trial' })).toEqual({ label: 'Trial expired', badge: 'red' })
  })

  it('classifies a trialing subscription', () => {
    expect(describeBillingStatus({ status: 'trialing', trialEndsAt: '2026-08-20T00:00:00.000Z' })).toEqual({
      label: 'Trial until Aug 20',
      badge: 'blue',
    })
  })

  it('classifies an inactive subscription', () => {
    expect(describeBillingStatus({ status: 'inactive' })).toEqual({ label: 'Inactive', badge: 'gray' })
  })
})

describe('subscription status card', () => {
  beforeEach(() => {
    resetMocks()
  })

  afterEach(() => {
    act(() => {
      roots.splice(0).forEach((root) => root.unmount())
      containers.splice(0).forEach((container) => container.remove())
    })
  })

  it('renders a loading card while the subscription status is unknown', async () => {
    render(
      <div>
        <StatusCard status="unknown" />
      </div>,
    )
    await settle()

    expect(document.body.textContent).toContain('Subscription status')
    expect(document.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders the active card when the subscription is active', async () => {
    render(
      <div>
        <StatusCard status="active" />
      </div>,
    )
    await settle()

    expect(document.body.textContent).toContain('Active')
    expect(document.body.textContent).toContain('You have full access to journaling.')
  })

  it('renders the trialing card with the trial end date', async () => {
    render(
      <div>
        <StatusCard status="trialing" trialEndsAt="2026-08-20T00:00:00.000Z" />
      </div>,
    )
    await settle()

    expect(document.body.textContent).toContain('Trial until Aug 20')
    expect(document.body.textContent).toContain('Aug 20')
  })

  it('renders the inactive card with an upgrade CTA', async () => {
    render(
      <div>
        <StatusCard status="inactive" />
      </div>,
    )
    await settle()

    expect(document.body.textContent).toContain('Inactive')
    const cta = Array.from(document.querySelectorAll('a,button')).find((el) =>
      el.textContent?.includes('Upgrade'),
    )
    expect(cta).toBeTruthy()
  })
})
