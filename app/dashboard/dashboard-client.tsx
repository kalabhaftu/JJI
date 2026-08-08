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
import type { DashboardDataQuality } from '@/lib/statistics/report-statistics'
import { HugeiconsIcon } from '@hugeicons/react'
import { InformationCircleIcon } from '@hugeicons/core-free-icons'

const DATA_QUALITY_MESSAGES: Record<Exclude<DashboardDataQuality, 'current'>, string> = {
  partial: 'Some data could not be loaded. The calculations below are partial and may not cover the full account scope.',
  stale: 'Showing cached calculations because the latest refresh failed.',
  unavailable: 'Aggregate calculations are unavailable right now.',
}

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

  const { error, refreshAllData, dataQuality } = useData()

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

      const navbar = document.querySelector('nav.sticky') as HTMLElement
      if (navbar) {
        const height = navbar.offsetHeight
        document.documentElement.style.setProperty('--navbar-height', `${height}px`)
      }
    }

    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 1024
    if (isMobileScreen) {
      document.documentElement.style.setProperty('--navbar-height', '48px')
      return
    }

    updateNavbarHeight()

    const navbar = document.querySelector('nav.sticky')
    let resizeObserver: ResizeObserver | null = null

    if (navbar) {
      resizeObserver = new ResizeObserver(() => {

        requestAnimationFrame(updateNavbarHeight)
      })
      resizeObserver.observe(navbar)
    }

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
            {dataQuality !== 'current' && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400"
              >
                <HugeiconsIcon icon={InformationCircleIcon} className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} color="currentColor" />
                <span>{DATA_QUALITY_MESSAGES[dataQuality]}</span>
              </div>
            )}
            <GettingStartedChecklist />
            <WidgetCanvas />
          </div>
        </ErrorBoundaryWrapper>
      </div>
    </DashboardErrorBoundary>
  )
}
