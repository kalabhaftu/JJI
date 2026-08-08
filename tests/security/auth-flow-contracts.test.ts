import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { getSafeRedirectPath } from '@/lib/security/redirects'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('authentication flow contracts', () => {
  it('routes the landing CTA through the canonical login flow', () => {
    const landing = source('app/home-page-client.tsx')

    expect(landing).toContain("const primaryHref = mainAppHref('/login?next=/dashboard')")
    expect(landing).not.toContain("const primaryHref = isAuthenticated ? '/dashboard' : '/login'")
  })

  it('opens an authenticated login session directly without a visible launcher route', () => {
    const rootClient = source('app/root-page-client.tsx')
    const authProvider = source('context/auth-provider.tsx')

    expect(rootClient).toContain('const serverSessionReady = await ensureServerSession()')
    expect(rootClient).toContain('router.replace(destination)')
    expect(rootClient).not.toContain('/app-launch')
    expect(authProvider).toContain('ensureServerSession')
    expect(authProvider).toContain('readLegacyBrowserSession()')
    expect(authProvider).toContain('await syncSessionToServer(legacySession)')
  })

  it('keeps browser auth cookie-first and preserves protected destinations', () => {
    const browserClient = source('lib/supabase.ts')
    const loginPage = source('app/login/page.tsx')
    const proxy = source('proxy.ts')

    expect(browserClient).toContain('return createBrowserClient(supabaseUrl, supabaseKey)')
    expect(browserClient).not.toContain('window.localStorage')
    expect(loginPage).toContain('supabase.auth.getClaims()')
    expect(loginPage).toContain('redirect(getSafeRedirectPath(nextUrl))')
    expect(proxy).toContain("url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)")
  })

  it('exchanges callback codes instead of rendering landing with a code query', () => {
    const rootPage = source('app/page.tsx')
    const callback = source('app/api/auth/callback/route.ts')

    expect(rootPage).toContain("redirect(`/api/auth/callback?${callbackParams.toString()}`)")
    expect(callback).toContain("supabase.auth.exchangeCodeForSession(code)")
    expect(callback).toContain('new URL(await getWebsiteURL()).origin')
  })

  it('keeps dashboard bootstrap server-owned and distinguishes auth from data failure', () => {
    const layout = source('app/dashboard/layout.tsx')
    const bootstrap = source('server/init-bootstrap.ts')
    const dataProvider = source('context/data-provider.tsx')

    expect(layout).toContain('getDashboardAccess()')
    expect(layout).toContain('<DashboardLoadingSkeleton />')
    expect(bootstrap).toContain("status: 'unauthenticated'")
    expect(bootstrap).toContain("status: 'unavailable'")
    expect(bootstrap).toContain('loadTradeCounts')
    expect(bootstrap).not.toContain('TRADE_COUNT_SELECT')
    expect(dataProvider).toContain('isDashboardBootstrapReady')
    expect(dataProvider).toContain('isAccountSelectionReady: isSelectionReady')
    expect(dataProvider).not.toContain("'/api/v1/init'")

    const widgetGrid = source('app/dashboard/components/widget-grid.tsx')
    const propFirmWidget = source('hooks/use-prop-firm-dashboard-widget-data.ts')
    expect(widgetGrid).toContain('!isDashboardBootstrapReady')
    expect(propFirmWidget).toContain('enabled && isScopeReady(scope)')
  })

  it('uses explicit current-session and all-device logout routes', () => {
    const logout = source('app/api/auth/logout/route.ts')
    const logoutAll = source('app/api/auth/logout-all/route.ts')
    const logoutHandler = source('server/auth/logout-route.ts')
    const authProvider = source('context/auth-provider.tsx')

    expect(logout).toContain("handleAuthLogout(request, 'local')")
    expect(logoutAll).toContain("handleAuthLogout(request, 'global')")
    expect(logoutHandler).toContain('status: 204')
    expect(logoutHandler).toContain('isSameOrigin')
    expect(authProvider).toContain("fetch(endpoint, {")
    expect(authProvider).toContain('window.location.replace')
  })

  it('does not clear unrelated browser storage during logout', () => {
    const navbar = source('app/dashboard/components/navbar.tsx')
    const settings = source('app/dashboard/settings/page.tsx')
    const subscribe = source('app/subscribe/subscribe-client.tsx')

    expect(navbar).not.toContain('localStorage.clear()')
    expect(navbar).not.toContain('sessionStorage.clear()')
    expect(settings).not.toContain('localStorage.clear()')
    expect(settings).not.toContain('sessionStorage.clear()')
    expect(subscribe).not.toContain('localStorage.clear()')
    expect(subscribe).not.toContain('sessionStorage.clear()')
  })

  it('uses the auth callback URL for email and provider redirects', () => {
    const providers = source('server/auth/providers.ts')
    const client = source('server/auth/client.ts')

    expect(client).toContain("new URL('api/auth/callback', websiteURL)")
    expect(client).toContain('resolveAuthOrigin({ requestOrigin })')
    expect(providers).toContain('emailRedirectTo')
    expect(providers).toContain('redirectTo: await getAuthCallbackUrl(next)')
  })

  it('waits for the server session before subscription confirmation polling', () => {
    const successPage = source('app/subscribe/success/page.tsx')

    expect(successPage).toContain('ensureServerSession')
    expect(successPage).toContain('if (!(await ensureServerSession()) || cancelled)')
    expect(successPage).toContain("retry: { mode: 'never' }")
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
