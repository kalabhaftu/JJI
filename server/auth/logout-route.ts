import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-logger'
import { resolveInternalUserId } from '@/server/user-identity'
import { createRouteHandlerClient } from '@/server/auth/client'

export type AuthLogoutScope = 'local' | 'global'

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) return false

  const fetchSite = request.headers.get('sec-fetch-site')
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none'
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}

export async function handleAuthLogout(request: NextRequest, scope: AuthLogoutScope) {
  if (!isSameOrigin(request)) return errorResponse('Cross-origin logout is not allowed.', 403)

  const response = new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
  const supabase = createRouteHandlerClient(request, response)

  const claimsResult = await supabase.auth.getClaims()
  const authUserId = typeof claimsResult.data?.claims?.sub === 'string'
    ? claimsResult.data.claims.sub
    : null

  const { error } = await supabase.auth.signOut({ scope })
  if (error) return errorResponse('Unable to sign out. Please try again.', 500)

  if (authUserId) {
    void resolveInternalUserId(authUserId).then((internalUserId) => {
      if (internalUserId) {
        logActivity({ userId: internalUserId, action: 'USER_LOGOUT', entity: 'Auth' })
      }
    }).catch(() => undefined)
  }

  return response
}
