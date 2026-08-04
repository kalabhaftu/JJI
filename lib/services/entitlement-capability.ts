export interface SubscriptionGuardResult {
  hasAccess: boolean
  status: string
  redirectTo?: string
  message?: string
}

export type EntitlementStatus = 'active' | 'trialing' | 'expired' | 'past_due' | 'cancelled' | 'unpaid' | 'unavailable' | 'permission_denied' | 'no_user'

export interface EntitlementCapability {
  canAccessDashboard: boolean
  canUsePlusFeatures: boolean
  status: EntitlementStatus
  source: 'server'
  isAuthoritative: false
  message?: string
}

const capabilityStatuses = new Set<EntitlementStatus>(['active', 'trialing', 'expired', 'past_due', 'cancelled', 'unpaid', 'unavailable', 'permission_denied', 'no_user'])

export function deriveEntitlementCapability(result: SubscriptionGuardResult | null | undefined): EntitlementCapability {
  const status = ['free_access', 'invited_free', 'promo_active', 'admin'].includes(result?.status ?? '')
    ? 'active'
    : result?.status === 'no_subscription'
      ? 'unavailable'
      : result?.status
  if (!result || typeof status !== 'string' || !capabilityStatuses.has(status as EntitlementStatus)) {
    return { canAccessDashboard: false, canUsePlusFeatures: false, status: 'unavailable', source: 'server', isAuthoritative: false, message: 'Entitlement is unavailable.' }
  }
  return {
    canAccessDashboard: result.hasAccess,
    canUsePlusFeatures: result.hasAccess && (status === 'active' || status === 'trialing' || status === 'past_due'),
    status: status as EntitlementStatus,
    source: 'server',
    isAuthoritative: false,
    ...(result.message ? { message: result.message } : {}),
  }
}
