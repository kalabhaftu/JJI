import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('client polling contracts', () => {
  it('does not refetch the settings subscription card on every window focus', () => {
    const settings = source('app/dashboard/settings/page.tsx')
    const subscriptionEffect = settings.slice(
      settings.indexOf("const [subscriptionData"),
      settings.indexOf('const regenerateWebhookToken'),
    )

    expect(subscriptionEffect).toContain("fetch('/api/v1/billing/status')")
    expect(subscriptionEffect).not.toContain("window.addEventListener('focus'")
    expect(subscriptionEffect).not.toContain('setInterval(')
  })

  it('does not run a background notification polling interval when realtime is unavailable', () => {
    const notificationCenter = source('components/notifications/notification-center.tsx')

    expect(notificationCenter).toContain('useDatabaseRealtime({')
    expect(notificationCenter).toContain("window.addEventListener('notifications:refresh'")
    expect(notificationCenter).not.toContain('setInterval(')
  })

  it('registers Synchronization in the realtime table registry', () => {
    const realtime = source('lib/realtime/database-realtime.ts')

    expect(realtime).toContain("'Synchronization'")
    expect(realtime).toContain('onSynchronizationChange')
  })

  it('runs auto-sync checks on demand instead of a fixed 1-minute interval', () => {
    for (const file of [
      'context/tradovate-sync-context.tsx',
      'context/dxfeed-sync-context.tsx',
      'hooks/use-rithmic-synchronization.ts',
    ]) {
      const ctx = source(file)

      expect(ctx).not.toContain('setInterval')
      expect(ctx).toContain('scheduleNextSync')
      expect(ctx).toContain("document.visibilityState === 'hidden'")
      expect(ctx).toContain("window.addEventListener('online'")
    }
  })

  it('triggers sync checks when the Synchronization row is updated via realtime', () => {
    for (const file of ['context/tradovate-sync-context.tsx', 'context/dxfeed-sync-context.tsx']) {
      const ctx = source(file)

      expect(ctx).toContain('useDatabaseRealtime({')
      expect(ctx).toContain('onSynchronizationChange')
    }
  })

  it('invalidates SWR caches on realtime refresh', () => {
    const accountsHook = source('hooks/use-accounts.ts')
    const realtimeHook = source('hooks/use-data-provider-realtime.ts')

    expect(accountsHook).toContain("export function invalidateAccountsCache(_reason?: string) {\n  clearAccountsCache()")
    expect(accountsHook).toContain("'/api/v1/accounts', '/api/v1/data-management/accounts'")
    expect(accountsHook).toContain("'/api/v1/trades', '/api/v1/data-management/trades'")
    expect(realtimeHook).toContain("clearTradesCache()")
    expect(realtimeHook).toContain("clearAccountsCache()")
  })

  it('checks for new deployments only while visible and stops after detection', () => {
    const hook = source('hooks/use-deployment-check.ts')
    const route = source('app/api/build-id/route.ts')

    expect(hook).toContain('process.env.NEXT_PUBLIC_BUILD_ID')
    expect(hook).toContain("if (document.visibilityState === 'hidden') return")
    expect(hook).toContain("window.addEventListener('focus'")
    expect(route).toContain("dynamic = 'force-static'")
  })

  it('deletes journal trades through the API instead of faking success', () => {
    const journal = source('app/dashboard/journal/components/journal-client.tsx')
    const deleteCall = journal.indexOf("apiRequest(`/api/v1/trades/${tradeToDelete.id}`")
    const toastIndex = journal.indexOf("toast.success('Trade deleted successfully')")

    expect(deleteCall).toBeGreaterThan(-1)
    expect(journal.slice(deleteCall, toastIndex)).toContain("method: 'DELETE'")
  })

  it('surfaces dashboard load errors with a retry action', () => {
    const errorBoundary = source('components/error-boundary.tsx')
    const dataProvider = source('context/data-provider.tsx')
    const dashboard = source('app/dashboard/dashboard-client.tsx')

    expect(errorBoundary).toContain('export function DataError')
    expect(dataProvider).toContain("setError('Failed to load data. Please refresh the page.')")
    expect(dataProvider).toContain('setError(null)')
    expect(dashboard).toContain('<DataError error={error} onRetry')
  })

  it('offers a retry action on the offline chip', () => {
    const offline = source('components/offline-indicator.tsx')

    expect(offline).toContain('Retry')
    expect(offline).toContain('navigator.onLine')
  })

  it('removed the dead full-screen loading overlay', () => {
    const loading = source('components/ui/loading.tsx')

    expect(loading).not.toContain('export function LoadingOverlay')
    expect(loading).not.toContain('positionClasses')
  })

  it('does not add artificial delays around data loading', () => {
    const dataProvider = source('context/data-provider.tsx')
    const propFirmPage = source('app/dashboard/prop-firm/accounts/[id]/page.tsx')

    expect(dataProvider).not.toContain('setTimeout(resolve, 200)')
    expect(propFirmPage).not.toContain("setTimeout(() => router.push('/dashboard/accounts'), 2000)")
  })

  it('hides less critical columns on tablet widths in the trade tables', () => {
    const reviewTable = source('app/dashboard/components/tables/trade-table-review.tsx')
    const dataTable = source('app/dashboard/data/components/data-management/trade-table.tsx')

    expect(reviewTable).toContain('AUTO_HIDDEN_ON_TABLET')
    expect(reviewTable).toContain('effectiveColumnVisibility')
    expect(dataTable).toContain('hidden lg:table-cell')
  })

  it('quick-add refreshes data instead of reloading the page', () => {
    const quickAdd = source('components/quick-add-fab.tsx')

    expect(quickAdd).not.toContain('window.location.reload()')
    expect(quickAdd).toContain('clearTradesCache()')
    expect(quickAdd).toContain('await refreshTrades()')
  })

  it('adds actionable descriptions to generic error toasts', () => {
    const notifications = source('components/notifications/notification-center.tsx')
    const journal = source('app/dashboard/journal/components/journal-client.tsx')
    const templates = source('context/template-provider.tsx')

    expect(notifications).toContain("description: 'Please try again.'")
    expect(journal).toContain("description: 'Your trades may be out of date. Please try again.'")
    expect(templates).toContain("description: 'Your dashboard layout may look different until you refresh.'")
  })

  it('explains that cleared caches refresh automatically', () => {
    const cache = source('app/dashboard/settings/components/cache-management.tsx')

    expect(cache).toContain('Data will refresh automatically.')
  })

  it('validates promo codes live via a dedicated API route', () => {
    const route = source('app/api/v1/payments/validate-promo/route.ts')
    const subscribe = source('app/subscribe/subscribe-client.tsx')

    expect(route).toContain("applyApiRoutePolicy(request, 'payment')")
    expect(route).toContain('validatePromoCode(code.trim().toUpperCase()')
    expect(subscribe).toContain("'/api/v1/payments/validate-promo'")
    expect(subscribe).toContain('setPromoValidation({ valid: false')
  })

  it('shows the getting-started checklist only for new users and allows dismissal', () => {
    const checklist = source('app/dashboard/components/getting-started-checklist.tsx')

    expect(checklist).toContain("onboardingStatus.setup !== 'not_started'")
    expect(checklist).toContain('jji_checklist_dismissed')
    expect(checklist).toContain('Dismiss getting started checklist')
  })
})
