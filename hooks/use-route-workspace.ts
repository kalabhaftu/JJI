'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export interface RouteWorkspaceController {
  open: boolean
  returnTo: string | null
  openWorkspace(href: string): void
  closeWorkspace(): void
}

export function useRouteWorkspace(fallbackReturnTo?: string): RouteWorkspaceController {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnToRef = useRef<string | null>(null)
  const [open, setOpen] = useState(false)
  const currentLocation = useMemo(() => {
    const query = searchParams.toString()
    return `${pathname}${query ? `?${query}` : ''}`
  }, [pathname, searchParams])

  const openWorkspace = useCallback((href: string) => {
    returnToRef.current = currentLocation
    setOpen(true)
    router.push(href, { scroll: false })
  }, [currentLocation, router])

  const closeWorkspace = useCallback(() => {
    const destination = returnToRef.current ?? fallbackReturnTo
    setOpen(false)
    returnToRef.current = null
    if (destination) router.replace(destination, { scroll: false })
  }, [fallbackReturnTo, router])

  return { open, returnTo: returnToRef.current, openWorkspace, closeWorkspace }
}
