

import { getUserAccessStatus } from './subscription/access'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { SubscriptionGuardResult } from './entitlement-capability'
export { deriveEntitlementCapability, type EntitlementCapability, type EntitlementStatus, type SubscriptionGuardResult } from './entitlement-capability'


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
