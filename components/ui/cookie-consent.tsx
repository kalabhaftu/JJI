"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Cookie, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { persistTelemetryConsent } from '@/lib/observability/telemetry-consent'

const COOKIE_NOTICE_KEY = 'jji-cookie-notice-dismissed'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(COOKIE_NOTICE_KEY) !== 'true') setVisible(true)
    const openNotice = () => setVisible(true)
    window.addEventListener('openCookiePreferences', openNotice)
    return () => window.removeEventListener('openCookiePreferences', openNotice)
  }, [])

  useEffect(() => {
    document.body.toggleAttribute('data-consent-banner', visible)
    return () => document.body.removeAttribute('data-consent-banner')
  }, [visible])

  const choose = (telemetryGranted: boolean) => {
    localStorage.setItem(COOKIE_NOTICE_KEY, 'true')
    persistTelemetryConsent(telemetryGranted)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside aria-labelledby="storage-notice-title" className="fixed inset-x-0 bottom-0 z-[9999] p-3 sm:p-5 md:right-auto md:max-w-[430px]">
      <div className="relative rounded-2xl border border-border/80 bg-background/95 p-5 shadow-xl backdrop-blur-xl">
        <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={() => choose(false)} aria-label="Use essential storage only"><X /></Button>
        <div className="flex items-start gap-3 pr-8">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Cookie className="h-4 w-4" /></span>
          <div>
            <h2 id="storage-notice-title" className="text-base font-semibold">Storage and operational telemetry</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Essential session and preference storage is always enabled. Optional telemetry sends only crash reports and sampled performance diagnostics. No ads, session replay, or behavioral tracking.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" asChild><Link href="/cookies">Read policy</Link></Button>
          <Button variant="outline" onClick={() => choose(false)}>Only essential</Button>
          <Button onClick={() => choose(true)}>Allow telemetry</Button>
        </div>
      </div>
    </aside>
  )
}
