import type { MembershipStatus } from '@whop/sdk/resources'

export type LocalWhopStatus = 'active' | 'past_due' | 'unpaid' | 'expired' | 'cancelled'

export function mapWhopStatusToLocal(status: MembershipStatus): LocalWhopStatus {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'completed':
    case 'canceling':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'cancelled'
    case 'expired':
      return 'expired'
    case 'unresolved':
    case 'drafted':
      return 'unpaid'
  }
}
