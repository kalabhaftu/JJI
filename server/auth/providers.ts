'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { logActivity } from '@/lib/activity-logger'
import { db } from '@/lib/db/client'
import { consumeRateLimitKey, emailOtpLimiter, getEmailRateLimitKey } from '@/lib/rate-limiter'
import { createClient, getAuthCallbackUrl } from '@/server/auth/client'
import { safeDbOperation } from '@/server/auth/database'

export async function signInWithDiscord(next: string | null = null) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: await getAuthCallbackUrl(next),
    },
  })
  if (error) throw new Error(error.message)
  return data.url ? { url: data.url } : { url: null }
}

export async function signInWithGoogle(next: string | null = null) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: await getAuthCallbackUrl(next),
    },
  })
  if (error) throw new Error(error.message)
  return data.url ? { url: data.url } : { url: null }
}


export async function signOut() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const internalUser = await db.query.User.findFirst({
      where: (table, { eq }) => eq(table.auth_user_id, user.id),
      columns: { id: true },
    })
    if (internalUser) logActivity({ userId: internalUser.id, action: 'USER_LOGOUT', entity: 'Auth' })
  }
  await supabase.auth.signOut()
  redirect('/?logout=true')
}

const EmailSchema = z.string().email("Please enter a valid email address")

export async function signInWithEmail(email: string, next: string | null = null) {
  const parsed = EmailSchema.safeParse(email)
  if (!parsed.success) {
    return {
      error: 'Invalid email address provided.',
      rateLimited: false,
      isExistingUser: false,
      emailSent: false
    }
  }

  const normalizedEmail = parsed.data.trim().toLowerCase()
  const emailLimit = await consumeRateLimitKey(getEmailRateLimitKey(normalizedEmail), emailOtpLimiter)

  if (!emailLimit.allowed) {
    return {
      error: 'Too many sign-in code requests. Please wait before trying again.',
      rateLimited: true,
      isExistingUser: false,
      emailSent: false
    }
  }

  const supabase = await createClient()
  const emailRedirectTo = await getAuthCallbackUrl(next)

  const existingUser = await safeDbOperation(
    () => db.query.User.findFirst({
      where: (table, { eq }) => eq(table.email, normalizedEmail)
    }),
    null
  )
  const isExistingUser = !!existingUser

  if (isExistingUser) {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo,
      },
    })

    if (error) {
      if (error.status === 429 && (error.message.includes('rate limit') || error.code === 'over_email_send_rate_limit')) {
        return {
          error: 'Too many sign-in code requests. Please wait before trying again.',
          rateLimited: true,
          isExistingUser: true,
          emailSent: false // Supabase didn't send the email due to rate limit
        }
      }

      return {
        error: 'Unable to send sign-in code. Please try again.',
        rateLimited: false,
        isExistingUser: true,
        emailSent: false
      }
    }

    return { isExistingUser: true, emailSent: true }
  } else {
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: generateTemporaryPassword(),
      options: {
        emailRedirectTo,
        data: {
          email: normalizedEmail,
        }
      }
    })

    if (error) {
      if (error.status === 429 && (error.message.includes('rate limit') || error.code === 'over_email_send_rate_limit')) {
        return {
          error: 'Too many sign-in code requests. Please wait before trying again.',
          rateLimited: true,
          isExistingUser: false,
          emailSent: false // Supabase didn't send the email due to rate limit
        }
      }

      return {
        error: 'Unable to send sign-in code. Please try again.',
        rateLimited: false,
        isExistingUser: false,
        emailSent: false
      }
    }

    return { isExistingUser: false, emailSent: true }
  }
}

function generateTemporaryPassword(): string {
  const uuid = crypto.randomUUID().replace(/-/g, '')
  return uuid.substring(0, 16) + 'A1!' // 16 chars + complexity
}
