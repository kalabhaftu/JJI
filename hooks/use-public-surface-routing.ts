'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  getDemoAwarePathname,
  getDemoHref,
  getDemoRouteHref,
  getDocsHref,
  isDemoHost,
  isDemoSurface,
  MAIN_APP_ORIGIN,
} from '@/lib/public-surface-routing'

export function useCurrentHostname() {
  const [hostname, setHostname] = useState<string | null>(null)

  useEffect(() => {
    setHostname(window.location.hostname)
  }, [])

  return hostname
}

export function usePublicSurfaceRouting() {
  const hostname = useCurrentHostname()

  return useMemo(
    () => ({
      hostname,
      isDemoHost: isDemoHost(hostname),
      isDemoSurface: (pathname?: string | null) => isDemoSurface(hostname, pathname ?? null),
      docsHref: (href?: string) => getDocsHref(href, hostname),
      demoHref: (href?: string) => getDemoHref(href, hostname),
      demoRouteHref: (href: string, isDemoMode: boolean) => getDemoRouteHref(href, isDemoMode, hostname),
      demoAwarePathname: (pathname: string, isDemoMode: boolean) =>
        getDemoAwarePathname(pathname, isDemoMode, hostname),
      exitDemoHref: isDemoHost(hostname) ? MAIN_APP_ORIGIN : '/',
    }),
    [hostname]
  )
}
