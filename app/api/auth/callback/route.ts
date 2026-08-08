'use server'
import { createClient, getWebsiteURL } from '@/server/auth/client'
import { ensureUserInDatabase } from '@/server/auth/user-provisioning'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity-logger'
import { captureUserGeo } from '@/server/geolocation'
import { resolveInternalUserId } from '@/server/user-identity'
import { getSafeRedirectPath } from '@/lib/security/redirects'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

export async function GET(request: Request) {
  const requestId = resolveRequestId(request.headers)
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error_code = searchParams.get('error_code')
  const next = searchParams.get('next')
  const action = searchParams.get('action')
  const baseUrl = new URL(await getWebsiteURL()).origin

  const authenticationFailure = () => {
    const loginUrl = new URL('/login', baseUrl)
    loginUrl.searchParams.set('error', 'auth_failed')
    if (next) loginUrl.searchParams.set('next', getSafeRedirectPath(next))
    return NextResponse.redirect(loginUrl)
  }

  if (error_code) {
    return authenticationFailure()
  }

  if (code) {
    try {
      const supabase = await createClient()

      const { data, error } = await withTimeout(
        supabase.auth.exchangeCodeForSession(code),
        15_000,
        'exchangeCodeForSession'
      )

      if (!error && data.user) {
        try {
          await withTimeout(
            ensureUserInDatabase(data.user, 'en'),
            8_000,
            'ensureUserInDatabase'
          )
         } catch (error) {
           reportError(error, {
             surface: 'api',
             operation: 'sync-auth-callback-user',
             route: '/api/auth/callback',
             requestId,
             userId: data.user.id,
           })

         }

        logActivity({ userId: data.user.id, action: 'USER_LOGIN', entity: 'Auth' })

        resolveInternalUserId(data.user.id).then(internalId => {
          if (internalId) captureUserGeo(internalId, request.headers)
        }).catch((e) => {
          reportError(e, {
            surface: 'background-job',
            operation: 'capture-auth-callback-geo',
            route: '/api/auth/callback',
            requestId,
            userId: data.user.id,
          })
        })

        if (action === 'link') {
          return NextResponse.redirect(new URL('/dashboard/settings?linked=true', baseUrl))
        }

        return NextResponse.redirect(new URL(getSafeRedirectPath(next), baseUrl))
      }

      return authenticationFailure()
     } catch (error) {
       reportError(error, {
         surface: 'api',
         operation: 'exchange-auth-callback-code',
         route: '/api/auth/callback',
         requestId,
       })
       return authenticationFailure()
     }
  }

  return authenticationFailure()
}
