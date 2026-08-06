import { create } from 'zustand'

export type BillingStatus = 'active' | 'trialing' | 'expired-trial' | 'inactive' | 'unknown'

export type SubscriptionStatus = 'unknown' | 'active' | 'trialing' | 'inactive'

export interface SubscriptionStoreState {
  status: SubscriptionStatus
  trialEndsAt: string | null
  billingStatus: BillingStatus
  checkedAt: string | null
  markActive: () => void
  markTrialing: (trialEndsAt: string | null) => void
  markInactive: () => void
  applySessionChange: (session: { billingStatus: BillingStatus; trialEndsAt: string | null }) => void
}

export const useSubscriptionStore = create<SubscriptionStoreState>((set) => ({
  status: 'unknown',
  trialEndsAt: null,
  billingStatus: 'unknown',
  checkedAt: null,
  markActive: () =>
    set({ status: 'active', billingStatus: 'active', checkedAt: new Date().toISOString() }),
  markTrialing: (trialEndsAt) =>
    set({
      status: 'trialing',
      billingStatus: 'trialing',
      trialEndsAt: trialEndsAt ?? null,
      checkedAt: new Date().toISOString(),
    }),
  markInactive: () =>
    set({
      status: 'inactive',
      billingStatus: 'inactive',
      trialEndsAt: null,
      checkedAt: new Date().toISOString(),
    }),
  applySessionChange: ({ billingStatus, trialEndsAt }) => {
    if (billingStatus === 'active') {
      set({ status: 'active', billingStatus: 'active', trialEndsAt: null, checkedAt: new Date().toISOString() })
      return
    }
    if (billingStatus === 'trialing') {
      set({
        status: 'trialing',
        billingStatus: 'trialing',
        trialEndsAt: trialEndsAt ?? null,
        checkedAt: new Date().toISOString(),
      })
      return
    }
    set({
      status: 'inactive',
      billingStatus: 'inactive',
      trialEndsAt: null,
      checkedAt: new Date().toISOString(),
    })
  },
}))
