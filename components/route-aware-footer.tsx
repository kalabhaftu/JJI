'use client'

import { usePathname } from 'next/navigation'

import { Footer } from '@/components/footer'
import { isAppShellPath } from '@/lib/navigation/app-shell'

export function RouteAwareFooter() {
  const pathname = usePathname()

  if (isAppShellPath(pathname)) {
    return null
  }

  return <Footer />
}
