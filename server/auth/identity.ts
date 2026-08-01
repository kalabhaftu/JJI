import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { headers } from 'next/headers'

import { reportError } from '@/lib/observability/report-error'
import { createClient } from '@/server/auth/client'

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
