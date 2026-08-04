

import { getUserAccessStatus } from './subscription/access'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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


export async function checkSubscriptionAccess(
  userId: string,
  knownUserRole?: string,
): Promise<SubscriptionGuardResult> {
  const user = knownUserRole
    ? { role: knownUserRole }
    : await db.query.User.findFirst({
        where: eq(schema.User.id, userId),
        columns: { role: true },
      })

  if (!user) {
    return {
      hasAccess: false,
      status: 'no_user',
      redirectTo: '/login',
      message: 'User not found',
    }
  }

  const access = await getUserAccessStatus(userId, user.role || undefined)

  if (access.hasAccess) {
    return { hasAccess: true, status: access.status }
  }


  let redirectTo = '/subscribe'
  let message = 'Please subscribe to access the dashboard.'

  switch (access.status) {
    case 'expired':
      message = 'Your subscription has expired. Please renew to continue.'
      break
    case 'past_due':
      message = 'Your payment is overdue. Please pay to maintain access.'
      break
    case 'cancelled':
      message = 'Your subscription was cancelled. Please resubscribe.'
      break
    case 'unpaid':
      message = 'Please subscribe to access the trading journal.'
      break
    default:
      break
  }

  return { hasAccess: false, status: access.status as string, redirectTo, message }
}
