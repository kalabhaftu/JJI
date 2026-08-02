'use client'

import NextDynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

import { DashboardErrorBoundary, ErrorBoundaryWrapper, DataError } from '@/components/error-boundary'
import { TemplateAwareDashboardSkeleton } from '@/components/ui/dashboard-skeleton'
import { cloneDefaultTemplateLayout } from '@/lib/dashboard/default-template-layout'
import { buildResponsiveDashboardLayouts } from '@/lib/dashboard/responsive-layouts'
import { GettingStartedChecklist } from './components/getting-started-checklist'
import { useData } from '@/context/data-provider'

const loadingLayout = cloneDefaultTemplateLayout()
const loadingLayouts = buildResponsiveDashboardLayouts(loadingLayout, false)

const WidgetCanvas = NextDynamic(() => import('./components/widget-grid'), {
  ssr: false,
  loading: () => (
    <TemplateAwareDashboardSkeleton
      layout={loadingLayout}
      layouts={loadingLayouts}
    />
  ),
})

const EditModeControls = NextDynamic(() => import('./components/edit-mode-controls'), {
  ssr: false
})

export function DashboardClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const { error, refreshAllData } = useData()

  // Redirect old ?tab= URLs to new standalone routes (backwards compatibility)
  useEffect(() => {
    const tab = searchParams?.get('tab')
    if (tab) {
      const routes: Record<string, string> = {
        'table': '/dashboard/table',
        'accounts': '/dashboard/accounts',
        'journal': '/dashboard/journal',
        'backtesting': '/dashboard/backtesting'
      }
      if (routes[tab]) {
        router.push(routes[tab] as any)
      }
    }
  }, [searchParams, router])

  useEffect(() => {
    const updateNavbarHeight = () => {
      // The navbar is now sticky (not fixed), query by sticky class
      const navbar = document.querySelector('nav.sticky') as HTMLElement
      if (navbar) {
        const height = navbar.offsetHeight
        document.documentElement.style.setProperty('--navbar-height', `${height}px`)
      }
    }

    // Skip ResizeObserver and event listeners on mobile/tablet screens to prevent layout thrashing
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 1024
    if (isMobileScreen) {
      document.documentElement.style.setProperty('--navbar-height', '48px')
      return
    }

    updateNavbarHeight()

    // Use ResizeObserver for navbar height changes
    const navbar = document.querySelector('nav.sticky')
    let resizeObserver: ResizeObserver | null = null

    if (navbar) {
      resizeObserver = new ResizeObserver(() => {
        // Wrap in requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
        requestAnimationFrame(updateNavbarHeight)
      })
      resizeObserver.observe(navbar)
    }

    // Fallback window resize listener
    window.addEventListener('resize', updateNavbarHeight)

    return () => {
      window.removeEventListener('resize', updateNavbarHeight)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [])

  return (
    <DashboardErrorBoundary>
      <div className="flex flex-1 flex-col w-full">
        <EditModeControls />
        <ErrorBoundaryWrapper context="Widgets">
          <div className="px-4 pb-24 lg:pb-0 dashboard-page-content">
            <DataError error={error} onRetry={() => void refreshAllData()} className="mb-4" />
            <GettingStartedChecklist />
            <WidgetCanvas />
          </div>
        </ErrorBoundaryWrapper>
      </div>
    </DashboardErrorBoundary>
  )
}
