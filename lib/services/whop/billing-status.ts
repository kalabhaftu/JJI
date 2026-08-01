import 'server-only'

import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { PaymentRecord, WhopMembership } from '@/lib/db/schema'
import { getUserAccessStatus } from '@/lib/services/subscription/access'
import { getConfiguredWhopEnvironment } from '@/lib/services/whop/config'

function safeManageUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && (url.hostname === 'whop.com' || url.hostname.endsWith('.whop.com'))
      ? url.toString()
      : null
  } catch {
    return null
  }
}

export async function getBillingStatus(userId: string, userRole?: string) {
  const environment = getConfiguredWhopEnvironment()
  const [access, whopMembership, latestPayment] = await Promise.all([
    getUserAccessStatus(userId, userRole),
    environment
      ? db.query.WhopMembership.findFirst({
          where: and(
            eq(WhopMembership.userId, userId),
            eq(WhopMembership.environment, environment),
          ),
          orderBy: [desc(WhopMembership.updatedAt)],
        })
      : Promise.resolve(undefined),
    db.query.PaymentRecord.findFirst({
      where: eq(PaymentRecord.userId, userId),
      orderBy: [desc(PaymentRecord.createdAt)],
      columns: { provider: true },
    }),
  ])

  const provider = whopMembership ? 'whop' : latestPayment?.provider ?? 'none'
  return {
    hasAccess: access.hasAccess,
    status: access.status,
    reason: access.reason,
    currentPeriodEnd: access.subscription?.currentPeriodEnd ?? null,
    nextPaymentDue: access.subscription?.nextPaymentDue ?? null,
    provider,
    manageUrl: whopMembership ? safeManageUrl(whopMembership.manageUrl) : null,
    membershipId: whopMembership?.membershipId ?? null,
    providerStatus: whopMembership?.status ?? null,
    cancelAtPeriodEnd: whopMembership?.cancelAtPeriodEnd ?? false,
  }
}
