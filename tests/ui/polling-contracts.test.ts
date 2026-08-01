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
})
