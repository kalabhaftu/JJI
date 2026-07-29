'use server'

import { logActivity } from '@/lib/activity-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { reportError } from '@/lib/observability/report-error'
import { createClient } from '@/server/auth/client'
import { safeDbOperation } from '@/server/auth/database'
import { ensureUserInDatabase } from '@/server/auth/user-provisioning'
import { eq } from 'drizzle-orm'

export async function verifyOtp(email: string, token: string, type: 'email' | 'signup' = 'email') {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: type
    })

    if (error) {
      if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('too many requests')) {
        throw new Error('Too many verification attempts. Please wait a moment before trying again.')
      }

      if (error.status === 403 ||
        error.message.includes('expired') ||
        error.message.includes('invalid') ||
        error.message.includes('Token has expired') ||
        error.message.includes('Invalid token') ||
        error.message.includes('Invalid login credentials') ||
        error.message.includes('Email not confirmed') ||
        error.message.includes('User not found')) {
        throw new Error(error.message)
      }
    }

    if (data?.user) {
      const verifiedUser = data.user
      // After successful OTP verification, ensure user exists in database (if DB is available)
      try {
        // Check if user already exists in our database with this email
        const existingUser = await safeDbOperation(
          () => db.query.User.findFirst({
            where: (table, { eq }) => eq(table.email, email)
          }),
          null
        )

        if (existingUser && existingUser.auth_user_id !== verifiedUser.id) {
          // User exists with different auth ID - update the auth_user_id instead of creating conflict
          const newAuthId = verifiedUser.id
          await safeDbOperation(
            () => db.update(schema.User).set({ auth_user_id: newAuthId }).where(eq(schema.User.email, email)),
            null
          )
        } else if (!existingUser) {
        const locale = 'en'
          await ensureUserInDatabase(verifiedUser, locale)
        }

      } catch (dbError) {
        reportError(dbError, {
          surface: 'server',
          operation: 'sync-verified-auth-user',
          userId: verifiedUser.id,
        })
      }

      const internalUser = await db.query.User.findFirst({
        where: (table, { eq }) => eq(table.auth_user_id, verifiedUser.id),
        columns: { id: true },
      })
      if (internalUser) logActivity({ userId: internalUser.id, action: 'USER_LOGIN', entity: 'Auth' })

      return data
    } else {
      // No user data means authentication failed
      throw new Error('Authentication failed - no user data returned')
    }

  } catch (error) {
    throw error
  }
}
