'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { hasTelemetryConsent } from '@/lib/observability/telemetry-consent'

export function Telemetry() {
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    const sync = () => setGranted(hasTelemetryConsent())
    sync()
    window.addEventListener('jji-telemetry-consent-change', sync)
    return () => window.removeEventListener('jji-telemetry-consent-change', sync)
  }, [])

  if (!granted) return null

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
