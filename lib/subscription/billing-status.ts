import type { BillingStatus } from '@/stores/subscription-store'

export interface BillingStatusView {
  label: string
  badge: 'green' | 'red' | 'blue' | 'gray'
}

function formatTrialEnd(trialEndsAt?: string | null): string {
  if (!trialEndsAt) return '...'
  return new Date(trialEndsAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function describeBillingStatus(session: {
  status: BillingStatus
  trialEndsAt?: string | null
}): BillingStatusView {
  switch (session.status) {
    case 'active':
      return { label: 'Active', badge: 'green' }
    case 'expired-trial':
      return { label: 'Trial expired', badge: 'red' }
    case 'trialing':
      return { label: `Trial until ${formatTrialEnd(session.trialEndsAt)}`, badge: 'blue' }
    default:
      return { label: 'Inactive', badge: 'gray' }
  }
}
