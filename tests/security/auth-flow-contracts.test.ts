import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { getSafeRedirectPath } from '@/lib/security/redirects'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('authentication flow contracts', () => {
  it('routes the landing CTA through the session launcher', () => {
    const landing = source('app/home-page-client.tsx')

    expect(landing).toContain("const primaryHref = mainAppLaunchHref('/dashboard')")
    expect(landing).not.toContain("const primaryHref = isAuthenticated ? '/dashboard' : '/login'")
  })

  it('sends unauthenticated launch attempts to login without returning to landing', () => {
    const launcher = source('app/app-launch/app-launch-client.tsx')

    expect(launcher).toContain('router.replace(`/login?next=${encodeURIComponent(nextPath)}`)')
    expect(launcher).not.toContain('router.replace(`/?next=${encodeURIComponent(nextPath)}`)')
  })

  it('exchanges callback codes instead of rendering landing with a code query', () => {
    const rootPage = source('app/page.tsx')
    const callback = source('app/api/auth/callback/route.ts')

    expect(rootPage).toContain("redirect(`/api/auth/callback?${callbackParams.toString()}`)")
    expect(callback).toContain("supabase.auth.exchangeCodeForSession(code)")
    expect(callback).toContain("const baseUrl = new URL(request.url).origin")
  })

  it('uses the auth callback URL for email and provider redirects', () => {
    const providers = source('server/auth/providers.ts')
    const client = source('server/auth/client.ts')

    expect(client).toContain("new URL('api/auth/callback', websiteURL)")
    expect(providers).toContain('emailRedirectTo')
    expect(providers).toContain('redirectTo: await getAuthCallbackUrl(next)')
  })

  it('isolates local dev output from production builds and bundle analysis', () => {
    const devRunner = source('scripts/run-next-dev.js')
    const packageJson = JSON.parse(source('package.json'))

    expect(devRunner).toContain("NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-dev'")
    expect(packageJson.scripts['build:analyze']).toContain('NEXT_DIST_DIR=.next-analyze')
  })

  it('only permits local redirect paths', () => {
    expect(getSafeRedirectPath('/dashboard/reports')).toBe('/dashboard/reports')
    expect(getSafeRedirectPath('https://example.com')).toBe('/dashboard')
    expect(getSafeRedirectPath('//example.com')).toBe('/dashboard')
    expect(getSafeRedirectPath('javascript:alert(1)')).toBe('/dashboard')
  })
})
