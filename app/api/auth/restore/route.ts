import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { z } from "zod"

import { ensureUserInDatabase } from '@/server/auth/user-provisioning'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

const restoreSessionSchema = z.object({
  accessToken: z.string().trim().min(1).max(8192),
  refreshToken: z.string().trim().min(1).max(8192),
})

type SupabaseCookie = {
  name: string
  value: string
  options?: CookieOptions
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'auth')
  if (limited) return limited
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ authenticated: false, error: "config" }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const parsed = restoreSessionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ authenticated: false, error: "invalid_tokens" }, { status: 400 })
  }

  const pendingCookies: SupabaseCookie[] = []

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: SupabaseCookie[]) {
        pendingCookies.splice(0, pendingCookies.length, ...cookiesToSet)
      },
    },
  })

  const { data, error } = await supabase.auth.setSession({
    access_token: parsed.data.accessToken,
    refresh_token: parsed.data.refreshToken,
  })

  if (error || !data.session || !data.user) {
    const errorResponse = NextResponse.json(
      { authenticated: false, error: "restore_failed" },
      { status: 401 },
    )
    pendingCookies.forEach(({ name, value, options }) => {
      errorResponse.cookies.set(name, value, options as any)
    })
    return errorResponse
  }

   try {
     await ensureUserInDatabase(data.user, "en")
   } catch (error) {
     reportError(error, {
       surface: 'api',
       operation: 'restore-profile-sync',
       route: request.nextUrl.pathname,
       requestId,
     })
     // Auth restoration should not fail because the profile sync is temporarily unavailable.
   }

  const response = NextResponse.json(
    {
      authenticated: true,
      userId: data.user.id,
    },
    { status: 200 },
  )

  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as any)
  })

  return response
}
