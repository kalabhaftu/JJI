import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

import { getSafeRedirectPath } from '@/lib/security/redirects'
import { resolveAuthOrigin } from '@/lib/security/auth-origin'

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

  // Never let a production auth callback follow a drifted preview env value.
  const hostedAuthOrigin = resolveAuthOrigin({ requestOrigin })
  if (hostedAuthOrigin) return `${hostedAuthOrigin}/`

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

export async function getAuthCallbackUrl(next: string | null = null) {
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


           }
        },
      },
    }
  )
}
