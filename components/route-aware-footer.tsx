'use client'

import { usePathname } from 'next/navigation'

import { Footer } from '@/components/footer'
import { usePublicSurfaceRouting } from '@/hooks/use-public-surface-routing'
import { isAppShellPath } from '@/lib/navigation/app-shell'

export function RouteAwareFooter() {
  const pathname = usePathname()
  const { isDemoSurface } = usePublicSurfaceRouting()

  if (isAppShellPath(pathname) || isDemoSurface(pathname)) {
    return null
  }

  return <Footer />
}
