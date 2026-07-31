'use server'
import * as Sentry from '@sentry/nextjs'
import { createClient, ensureUserInDatabase } from '@/server/auth'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity-logger'
import { captureUserGeo } from '@/server/geolocation'
import { resolveInternalUserId } from '@/server/user-identity'
import { getSafeRedirectPath } from '@/lib/security/redirects'
import logger from '@/lib/logger'

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error_code = searchParams.get('error_code')
  const next = searchParams.get('next')
  const action = searchParams.get('action')
  const baseUrl = new URL(request.url).origin

  if (error_code) {
    if (error_code === 'bad_oauth_state') {
      return NextResponse.redirect(new URL('/', baseUrl))
    }
    return NextResponse.redirect(new URL('/dashboard', baseUrl))
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
           Sentry.captureException(error, { extra: { route: '/api/auth/callback', phase: 'ensureUserInDatabase' } })
           // Auth succeeded; DB sync can happen on the next page load.
         }

        logActivity({ userId: data.user.id, action: 'USER_LOGIN', entity: 'Auth' })

        resolveInternalUserId(data.user.id).then(internalId => {
          if (internalId) captureUserGeo(internalId, request.headers)
        }).catch((e) => {
          logger.error({ error: e, userId: data.user.id }, 'Error updating geo log during auth callback')
        })

        if (action === 'link') {
          return NextResponse.redirect(new URL('/dashboard/settings?linked=true', baseUrl))
        }

        return NextResponse.redirect(new URL(getSafeRedirectPath(next), baseUrl))
      }

      return NextResponse.redirect(new URL('/', baseUrl))
     } catch (error) {
       Sentry.captureException(error, { extra: { route: '/api/auth/callback' } })
       return NextResponse.redirect(new URL('/', baseUrl))
     }
  }

  return NextResponse.redirect(new URL('/', baseUrl))
}
