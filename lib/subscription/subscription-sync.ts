import { useAuthStore } from '@/stores/auth-store'
import { useSubscriptionStore, type BillingStatus } from '@/stores/subscription-store'

export interface BillingSession {
  billingStatus?: BillingStatus
  status?: BillingStatus
  trialEndsAt?: string | null
}

function resolveBillingStatus(session: BillingSession): BillingStatus | undefined {
  return session.billingStatus ?? session.status
}

export function applyAuthToBilling(): void {
  const session = useAuthStore.getState()
  const store = useSubscriptionStore.getState()

  if (session.status !== 'signed-in' || !session.user) {
    store.markInactive()
    return
  }

  if (session.user.billingActive) {
    store.markActive()
    return
  }

  if (session.user.trialActive) {
    store.markTrialing(session.user.trialEndsAt ?? null)
    return
  }

  store.markInactive()
}

export function syncBillingToAuth(session: BillingSession | null): void {
  const billingStatus = resolveBillingStatus(session ?? {})
  if (!billingStatus) return

  const normalizedStatus: BillingStatus =
    billingStatus === 'expired-trial' ? 'inactive' : billingStatus
  const trialEndsAt = billingStatus === 'trialing' ? (session?.trialEndsAt ?? null) : null

  useSubscriptionStore.getState().applySessionChange({ billingStatus: normalizedStatus, trialEndsAt })
}

export function resetSubscriptionStore(session?: BillingSession | null): void {
  const billingStatus = resolveBillingStatus(session ?? {})
  if (!billingStatus) return

  const store = useSubscriptionStore.getState()
  switch (billingStatus) {
    case 'active':
      store.markActive()
      break
    case 'trialing':
      store.markTrialing(session?.trialEndsAt ?? null)
      break
    case 'expired-trial':
    case 'inactive':
      store.markInactive()
      break
    default:
      break
  }
}
