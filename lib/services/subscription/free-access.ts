import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { FreeAccessInvite, Subscription, User } from '@/lib/db/schema'
import { createPaymentNotification } from '@/lib/services/subscription/notifications'

export async function grantFreeAccess(params: {
  email: string
  type: 'lifetime' | 'until_date' | 'one_time_signup'
  expiresAt?: Date
  note?: string
  grantedBy?: string
}) {
  let invite = await db.query.FreeAccessInvite.findFirst({ where: eq(FreeAccessInvite.email, params.email) })
  if (!invite) {
    const [newInvite] = await db.insert(FreeAccessInvite).values({
      email: params.email,
      type: params.type,
      expiresAt: params.expiresAt,
      note: params.note,
      grantedBy: params.grantedBy,
      isActive: true,
      updatedAt: new Date(),
    }).returning()
    invite = newInvite
  } else {
    const [updated] = await db.update(FreeAccessInvite).set({
      type: params.type,
      expiresAt: params.expiresAt,
      note: params.note,
      grantedBy: params.grantedBy,
      isActive: true,
      revokedAt: null,
    }).where(eq(FreeAccessInvite.id, invite.id)).returning()
    invite = updated
  }

  // If user already exists, auto-activate their subscription
  const user = await db.query.User.findFirst({ where: eq(User.email, params.email) })
  if (user) {
    let userSub = await db.query.Subscription.findFirst({ where: eq(Subscription.userId, user.id) })
    if (!userSub) {
      await db.insert(Subscription).values({
        userId: user.id,
        status: 'free_access',
        freeAccessId: invite?.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: params.expiresAt || null,
        updatedAt: new Date(),
      })
    } else {
      await db.update(Subscription).set({
        status: 'free_access',
        freeAccessId: invite?.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: params.expiresAt || null,
      }).where(eq(Subscription.id, userSub.id))
    }

    await createPaymentNotification(
      user.id,
      'ADMIN_FREE_ACCESS_GRANTED',
      'Free Access Granted',
      params.note || 'You have been granted free access to JJI Pro.'
    )
  }

  return invite
}

export async function revokeFreeAccess(email: string) {
  const invite = await db.query.FreeAccessInvite.findFirst({ where: eq(FreeAccessInvite.email, email) })
  if (!invite) return null

  await db.update(FreeAccessInvite)
    .set({ isActive: false, revokedAt: new Date() })
    .where(eq(FreeAccessInvite.id, invite.id))

  if (invite.registeredUserId) {
    await db.update(Subscription)
      .set({ status: 'expired' })
      .where(and(eq(Subscription.userId, invite.registeredUserId), eq(Subscription.freeAccessId, invite.id)))

    await createPaymentNotification(
      invite.registeredUserId,
      'ADMIN_FREE_ACCESS_REVOKED',
      'Free Access Revoked',
      'Your free access to JJI Pro has been revoked.'
    )
  }

  return invite
}
