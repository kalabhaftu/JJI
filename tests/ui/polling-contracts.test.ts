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
})
