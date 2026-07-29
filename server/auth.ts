'use server'
import { createServerClient } from '@supabase/ssr'
import { reportError } from '@/lib/observability/report-error'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export const safeDbOperation = async <T>(
  operation: () => Promise<T>,
  fallbackValue?: T
): Promise<T | undefined> => {
  try {
    return await operation()
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'safe-database-operation',
    })
    return fallbackValue
  }
}
import { headers } from "next/headers"
import { logActivity } from '@/lib/activity-logger'
import { extractUserSettingsWriteData } from '@/lib/user-settings'
import { emailOtpLimiter, consumeRateLimitKey, getEmailRateLimitKey } from '@/lib/rate-limiter'
import { getSafeRedirectPath } from '@/lib/security/redirects'
// Removed locales import - using plain English strings

function isLocalDevelopment() {
  const isVercel = process.env.VERCEL === '1'
  return process.env.NODE_ENV === 'development' && !isVercel
}

function getConfiguredAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || null
}

async function getRequestOrigin() {
  const headerStore = await headers()
  const origin = headerStore.get('origin')
  if (origin) return new URL(origin).origin

  const forwardedProto = headerStore.get('x-forwarded-proto') || 'http'
  const forwardedHost = headerStore.get('x-forwarded-host') || headerStore.get('host')
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`

  return null
}

export async function getWebsiteURL() {
  const requestOrigin = await getRequestOrigin()
  if (isLocalDevelopment() && requestOrigin) {
    return requestOrigin.endsWith('/') ? requestOrigin : `${requestOrigin}/`
  }

  const configuredUrl = getConfiguredAppUrl()

  if (!configuredUrl) {
    if (isLocalDevelopment()) {
      return 'http://localhost:3000/'
    }
    throw new Error('NEXT_PUBLIC_APP_URL must be configured outside local development')
  }

  const normalizedUrl = configuredUrl.startsWith('http') ? configuredUrl : `https://${configuredUrl}`
  const origin = new URL(normalizedUrl).origin
  return origin.endsWith('/') ? origin : `${origin}/`
}

async function getAuthCallbackUrl(next: string | null = null) {
  const websiteURL = await getWebsiteURL()
  const url = new URL('api/auth/callback', websiteURL)

  if (next) {
    url.searchParams.set('next', getSafeRedirectPath(next))
  }

  return url.toString()
}

export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const hasPlaceholderValues = !supabaseUrl || !supabaseKey ||
    supabaseUrl.includes('[YOUR_PROJECT_REF]') ||
    supabaseKey.includes('your-anon-key') ||
    supabaseUrl === 'https://[YOUR_PROJECT_REF].supabase.co' ||
    supabaseKey === 'your-anon-key-from-supabase' ||
    supabaseUrl === 'https://your-project.supabase.co' ||
    supabaseKey === 'your-anon-key-here'

  if (hasPlaceholderValues && process.env.NODE_ENV === 'production') {
    throw new Error('Supabase configuration is incomplete. Please check your environment variables.')
  }

  // In non-production, use placeholder values that won't break the build
  const finalUrl = hasPlaceholderValues ? 'https://placeholder.supabase.co' : supabaseUrl!
  const finalKey = hasPlaceholderValues ? 'placeholder-key-for-build' : supabaseKey!

  return createServerClient(
    finalUrl,
    finalKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
           } catch {
             // The `setAll` method was called from a Server Component.
             // This can be ignored if you have middleware refreshing
             // user sessions.
           }
        },
      },
    }
  )
}

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

import { z } from 'zod'

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

interface SupabaseUser {
  id: string;
  email?: string | null;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
  };
}

function hasStoredName(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function buildGeneratedNames(user: SupabaseUser) {
  const metadata = user.user_metadata
  const fullName = metadata?.full_name?.trim() || metadata?.name?.trim() || null

  const firstName =
    metadata?.first_name?.trim() ||
    (fullName ? fullName.split(/\s+/)[0] : null) ||
    null

  const lastName =
    metadata?.last_name?.trim() ||
    (fullName && fullName.includes(' ')
      ? fullName.split(/\s+/).slice(1).join(' ').trim() || null
      : null)

  return { firstName, lastName }
}

function shouldHydrateNamesFromProvider(user: SupabaseUser) {
  const provider = user.app_metadata?.provider?.toLowerCase()
  const providers = (user.app_metadata?.providers || []).map(value => value.toLowerCase())
  return provider === 'google' || providers.includes('google')
}

export async function ensureUserInDatabase(user: SupabaseUser, locale?: string) {

  if (!user) {
    await signOut();
    throw new Error('User data is required for authentication.');
  }

  if (!user.id) {
    await signOut();
    throw new Error('User ID is required for authentication.');
  }

  try {
    const existingUserByAuthId = await safeDbOperation(
      () => db.query.User.findFirst({
        where: (table, { eq }) => eq(table.auth_user_id, user.id),
      }),
      null
    )

    const generatedNames = buildGeneratedNames(user)
    const shouldHydrateNames = shouldHydrateNamesFromProvider(user)

    if (existingUserByAuthId) {
      const needsEmailUpdate = existingUserByAuthId.email !== user.email
      const shouldFillFirstName =
        shouldHydrateNames &&
        !hasStoredName(existingUserByAuthId.firstName) &&
        hasStoredName(generatedNames.firstName)
      const shouldFillLastName =
        shouldHydrateNames &&
        !hasStoredName(existingUserByAuthId.lastName) &&
        hasStoredName(generatedNames.lastName)

      if (needsEmailUpdate || shouldFillFirstName || shouldFillLastName) {
        const updateData: any = {}

        if (needsEmailUpdate) {
          updateData.email = user.email || existingUserByAuthId.email
        }

        if (shouldFillFirstName) {
          updateData.firstName = generatedNames.firstName
        }

        if (shouldFillLastName) {
          updateData.lastName = generatedNames.lastName
        }

        try {
          const updatedUser = await safeDbOperation(
            () => db.transaction(async (tx) => {
              const updated = await tx.update(schema.User).set(updateData).where(eq(schema.User.auth_user_id, user.id)).returning().then(r => r[0]);

              if (!updated) throw new Error('Failed to update user');

              await tx.insert(schema.UserSettings).values({
                userId: updated.id,
                ...extractUserSettingsWriteData(updated as any),
                updatedAt: new Date()
              }).onConflictDoNothing();

              const accountCountRes = await tx.select({ count: sql`count(*)` }).from(schema.Account).where(eq(schema.Account.userId, updated.id));
              const accountCount = Number(accountCountRes[0]?.count || 0);
              
              const masterAccountCountRes = await tx.select({ count: sql`count(*)` }).from(schema.MasterAccount).where(eq(schema.MasterAccount.userId, updated.id));
              const masterAccountCount = Number(masterAccountCountRes[0]?.count || 0);
              
              if (accountCount === 0 && masterAccountCount === 0) {
                await tx.insert(schema.Account).values({
                  id: crypto.randomUUID(),
                  number: 'Default',
                  name: 'Main Trading Account',
                  startingBalance: 0,
                  isConfigured: false,
                  userId: updated.id,
                  updatedAt: new Date()
                });
              }

              return updated;
            }),
            existingUserByAuthId
          );
          return JSON.parse(JSON.stringify(updatedUser));
        } catch (updateError) {
          throw new Error('Failed to synchronize user profile.');
        }
      }
      
      const accounts = await db.query.Account.findFirst({ where: (table, { eq }) => eq(table.userId, existingUserByAuthId.id) });
      const masterAccounts = await db.query.MasterAccount.findFirst({ where: (table, { eq }) => eq(table.userId, existingUserByAuthId.id) });
      
      if (!accounts && !masterAccounts) {
        await db.insert(schema.Account).values({
            id: crypto.randomUUID(),
            number: 'Default',
            name: 'Main Trading Account',
            startingBalance: 0,
            isConfigured: false,
            userId: existingUserByAuthId.id,
            updatedAt: new Date()
        });
      }

      return JSON.parse(JSON.stringify(existingUserByAuthId));
    }

    if (user.email) {
      const existingUserByEmail = await safeDbOperation(
        () => db.query.User.findFirst({
          where: (table, { eq }) => eq(table.email, user.email!),
        }),
        null
      )

      if (existingUserByEmail && existingUserByEmail.auth_user_id !== user.id) {
        const relinkedUser = await safeDbOperation(
          () => db.transaction(async (tx) => {
              const updated = await tx.update(schema.User).set({
                auth_user_id: user.id,
                email: user.email || existingUserByEmail.email,
                firstName: hasStoredName(existingUserByEmail.firstName)
                  ? existingUserByEmail.firstName
                  : (shouldHydrateNames ? generatedNames.firstName : existingUserByEmail.firstName),
                lastName: hasStoredName(existingUserByEmail.lastName)
                  ? existingUserByEmail.lastName
                  : (shouldHydrateNames ? generatedNames.lastName : existingUserByEmail.lastName),
              }).where(eq(schema.User.email, user.email!)).returning().then(r => r[0]);

            if (!updated) throw new Error('Failed to update user');

            await tx.insert(schema.UserSettings).values({
                userId: updated.id,
                ...extractUserSettingsWriteData(updated as any),
                updatedAt: new Date()
              }).onConflictDoNothing();

              const accountCountRes = await tx.select({ count: sql`count(*)` }).from(schema.Account).where(eq(schema.Account.userId, updated.id));
              const accountCount = Number(accountCountRes[0]?.count || 0);
              
              const masterAccountCountRes = await tx.select({ count: sql`count(*)` }).from(schema.MasterAccount).where(eq(schema.MasterAccount.userId, updated.id));
            const masterAccountCount = Number(masterAccountCountRes[0]?.count || 0);
            
            if (accountCount === 0 && masterAccountCount === 0) {
              await tx.insert(schema.Account).values({
                  id: crypto.randomUUID(),
                  number: 'Default',
                  name: 'Main Trading Account',
                  startingBalance: 0,
                  isConfigured: false,
                  userId: updated.id,
                  updatedAt: new Date()
              });
            }

            return updated;
          }),
          null
        )

        if (!relinkedUser) {
          throw new Error('Failed to relink existing user account')
        }

        logActivity({
          userId: relinkedUser.id,
          action: 'USER_AUTH_RELINKED',
          entity: 'Auth',
          entityId: relinkedUser.id,
          metadata: {
            previousUserId: existingUserByEmail.id,
            previousAuthUserId: existingUserByEmail.auth_user_id,
            email: user.email,
          },
        })

        return JSON.parse(JSON.stringify(relinkedUser));
      }
    }

    try {
      const newUser = await safeDbOperation(
        () => db.transaction(async (tx) => {
          const created = await tx.insert(schema.User).values({
              auth_user_id: user.id,
              email: user.email || '',
              id: crypto.randomUUID(),
              role: 'user',
              firstName: generatedNames.firstName,
              lastName: generatedNames.lastName
          }).returning().then(r => r[0]);

          if (!created) {
            throw new Error('Failed to insert user record');
          }

          await tx.insert(schema.UserSettings).values({
              userId: created.id,
              ...extractUserSettingsWriteData(created as any),
              updatedAt: new Date()
          });

      await tx.insert(schema.Account).values({
              id: crypto.randomUUID(),
              number: 'Default',
              name: 'Main Trading Account',
              startingBalance: 0,
              isConfigured: false,
              userId: created.id,
              updatedAt: new Date()
          });

          return created;
        }),
        null
      );



      if (!newUser) {
        throw new Error('Failed to create user record in database');
      }

      logActivity({ userId: newUser.id, action: 'USER_SIGNUP', entity: 'Auth' })

      // Create default dashboard template for new user (non-blocking)
      try {
        const { ensureDefaultTemplate } = await import('./seed-default-template')
        await ensureDefaultTemplate()
      } catch (templateError) {
        // Don't block user creation if template fails
      }

      return JSON.parse(JSON.stringify(newUser));
    } catch (createError) {
      if (createError instanceof Error &&
        createError.message.includes('Unique constraint failed')) {
        await signOut();
        throw new Error('Database integrity error: Duplicate user records found');
      }
      await signOut();
      throw new Error('Failed to create user account');
    }
  } catch (error) {
    // Re-throw NEXT_REDIRECT errors immediately (these are normal Next.js redirects)
    if (error instanceof Error && (
      error.message === 'NEXT_REDIRECT' ||
      ('digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))
    )) {
      throw error;
    }

    // Handle database connection errors gracefully - DON'T sign out user
    if (error instanceof Error && (
      error.message.includes("Can't reach database server") ||
      error.message.includes('P1001') ||
      error.message.includes('Connection timeout') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    )) {
      // Return without signing out - let the middleware handle the auth state
      return null;
    }

    // Handle Prisma validation errors (these require sign out)
    if (error instanceof Error) {
      if (error.message.includes('Argument `where` of type UserWhereUniqueInput needs')) {
        await signOut();
        throw new Error('Invalid user identification provided');
      }

      if (error.message.includes('Unique constraint failed')) {
        await signOut();
        throw new Error('Database integrity error: Duplicate user records found');
      }

      if (error.message.includes('Account conflict')) {
        // Error already handled above
        throw error;
      }
    }

    // For authentication-related errors, sign out the user
    if (error instanceof Error && (
      error.message.includes('User not authenticated') ||
      error.message.includes('Invalid authentication') ||
      error.message.includes('Token expired') ||
      error.message.includes('Invalid token')
    )) {
      await signOut();
      throw new Error('Authentication error occurred. Please log in again.');
    }

    // For other unexpected errors, don't sign out - just log and continue
    return null;
  }
}

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

// Optimized function that uses middleware data when available
export async function getUserId(): Promise<string> {
  try {
    const headersList = await headers()

    // Support Authorization: Bearer token from mobile/CLI clients
    const authHeader = headersList.get('authorization') || headersList.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      if (token.length > 0) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (supabaseUrl && supabaseKey) {
          const supabase = createServerClient(supabaseUrl, supabaseKey, {
            cookies: {
              getAll: () => [],
              setAll: () => {},
            },
          })
          const { data: { user }, error } = await supabase.auth.getUser(token)
          if (!error && user) {
            return user.id
          }
        }
      }
    }

    const userIdFromMiddleware = headersList.get('x-user-id')
    const authStatus = headersList.get('x-user-authenticated')

    if (userIdFromMiddleware && authStatus === "authenticated") {
      return userIdFromMiddleware
    }

    if (authStatus === "unauthenticated") {
      const authError = headersList.get('x-auth-error')
      if (authError && authError.includes("timeout")) {
        throw new Error("Authentication service temporarily unavailable")
      }
      throw new Error("User not authenticated")
    }
  } catch (headerError) {
  }

  try {
    const supabase = await createClient()

    // Add timeout to Supabase call with reasonable timeout for stability
    const authPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Auth timeout")), 10000) // Increased to 10 seconds for stability
    )

    const { data: { user }, error } = await Promise.race([authPromise, timeoutPromise]) as any

    if (error) {
      if (error.message?.includes("timeout")) {
        throw new Error("Authentication service temporarily unavailable")
      }

      throw new Error("User not authenticated")
    }

    if (!user) {
      throw new Error("User not authenticated")
    }

    return user.id
  } catch (authError) {
    if (authError instanceof Error) {
      if (authError.message === "Auth timeout") {
        throw new Error("Authentication service temporarily unavailable")
      }
      if (authError.message.includes("fetch failed") || authError.message.includes("ConnectTimeoutError")) {
        throw new Error("Authentication service temporarily unavailable")
      }
    }
    throw new Error("User not authenticated")
  }
}

async function getUserEmail(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email || ""
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'get-authenticated-user-email',
      extra: { fallbackUsed: true },
    })
    return ""
  }
}

/**
 * Get user ID safely - returns null for unauthenticated users instead of throwing
 * Use this in server actions that should handle unauthenticated users gracefully
 */
export async function getUserIdSafe(): Promise<string | null> {
  try {
    return await getUserId()
  } catch (error) {
    if (error instanceof Error && error.message.includes("not authenticated")) {
      return null // Return null for unauthenticated users instead of throwing
    }
    throw error // Re-throw other errors (like service unavailable)
  }
}

export async function linkDiscordAccount() {
  const supabase = await createClient()
  const websiteURL = await getWebsiteURL()
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'discord',
    options: {
      redirectTo: `${websiteURL}api/auth/callback?action=link`,
    },
  })
  if (error) {
    throw new Error(error.message)
  }
  return data.url ? { url: data.url } : { url: null }
}

export async function linkGoogleAccount() {
  const supabase = await createClient()
  const websiteURL = await getWebsiteURL()
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: `${websiteURL}api/auth/callback?action=link`,
    },
  })
  if (error) {
    throw new Error(error.message)
  }
  return data.url ? { url: data.url } : { url: null }
}

export async function unlinkIdentity(identity: any) {
  const supabase = await createClient()
  const { error } = await supabase.auth.unlinkIdentity(identity)
  if (error) {
    throw new Error(error.message)
  }
  return { success: true }
}

export async function getUserIdentities() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('User not authenticated')
  }

  // Get user's identities using the proper method
  const { data: identities, error: identitiesError } = await supabase.auth.getUserIdentities()

  if (identitiesError) {
    throw new Error(identitiesError.message)
  }

  return identities
}
