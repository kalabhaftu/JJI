/**
 * Authentication check API for middleware
 * GET /api/auth/check - Check if user is authenticated
 *
 * OPTIMIZED: Removed expensive database calls and simplified auth check
 * This route should only be used as a fallback, not primary auth method
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  // Set a very short timeout since this is just a fallback check
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 500) // 500ms timeout

  try {
    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Configuration error' },
        { status: 500 }
      )
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
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
              // Ignore cookie setting errors in middleware context
            }
          },
        },
      }
    )

    // Simple auth check without expensive operations
    const authPromise = supabase.auth.getUser()
    const { data: { user }, error } = await authPromise

    clearTimeout(timeoutId)

    if (error) {
      // Only log non-timeout errors
      if (!error.message.includes('AbortError') && !error.message.includes('timeout')) {
      }
      return NextResponse.json(
        { error: 'Auth check failed' },
        { status: 401 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Minimal response
    return NextResponse.json(
      {
        authenticated: true,
        userId: user.id
      },
      { status: 200 }
    )

  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Auth timeout' },
          { status: 408 }
        )
      }

      if (error.message.includes('fetch failed') || error.message.includes('ConnectTimeoutError')) {
        return NextResponse.json(
          { error: 'Network error' },
          { status: 503 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Auth check failed' },
      { status: 500 }
    )
  }
}
